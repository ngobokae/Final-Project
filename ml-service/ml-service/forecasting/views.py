from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import jwt
from django.conf import settings
import numpy as np
import pandas as pd
from datetime import timedelta
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestRegressor
import warnings

try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    tf = None
    TF_AVAILABLE = False

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    Prophet = None
    PROPHET_AVAILABLE = False

try:
    from statsmodels.tsa.arima.model import ARIMA
    STATS_MODELS_AVAILABLE = True
except ImportError:
    ARIMA = None
    STATS_MODELS_AVAILABLE = False

warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=UserWarning)
warnings.filterwarnings('ignore', category=DeprecationWarning)
warnings.filterwarnings('ignore', category=RuntimeWarning)


def _safe_int(value, default=0):
    try:
        return int(round(float(value)))
    except Exception:
        return default


def _safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


class HealthView(APIView):
    """GET /api/health/ - Check if the ML service is running."""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({
            'status': 'ok',
            'service': 'ml-service',
            'endpoints': {
                'forecast': 'POST /api/forecast/',
                'optimize_inventory': 'POST /api/optimize-inventory/',
            }
        }, status=status.HTTP_200_OK)


class ForecastView(APIView):
    """
    Demand forecasting endpoint.
    Accepts historical sales data and returns forecasted demand.
    """
    
    def post(self, request):
        try:
            auth_header = request.headers.get('Authorization', '')
            if auth_header:
                token = auth_header.split(' ')[1] if ' ' in auth_header else None
                if token:
                    try:
                        jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
                    except jwt.InvalidTokenError:
                        return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)

            product_id = request.data.get('product_id')
            historical_data = request.data.get('historical_data', [])
            days_ahead = int(request.data.get('days_ahead', 30))
            model_type = str(request.data.get('model_type', 'ensemble')).lower()

            if not product_id:
                return Response({'error': 'product_id is required'}, status=status.HTTP_400_BAD_REQUEST)

            if len(historical_data) < 1:
                return Response({'error': 'Insufficient historical data. Need at least 1 data point'}, status=status.HTTP_400_BAD_REQUEST)

            df = pd.DataFrame(historical_data)
            df['sale_date'] = pd.to_datetime(df['sale_date'])
            df = df.sort_values('sale_date')
            df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')
            df = df.dropna(subset=['quantity'])

            if len(df) < 1:
                return Response({'error': 'Insufficient valid data points'}, status=status.HTTP_400_BAD_REQUEST)

            forecasts = self._generate_forecast(df, days_ahead, model_type)
            insights = self._calculate_insights(df, forecasts)

            return Response({
                'success': True,
                'product_id': product_id,
                'model_type': model_type,
                'forecasts': forecasts,
                'insights': insights
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _generate_forecast(self, df, days_ahead, model_type='ensemble'):
        model_type = str(model_type or 'ensemble').lower()
        if model_type == 'arima':
            return self._forecast_arima(df, days_ahead)
        if model_type == 'prophet':
            return self._forecast_prophet(df, days_ahead)
        if model_type == 'random_forest':
            return self._forecast_random_forest(df, days_ahead)
        if model_type == 'lstm':
            return self._forecast_lstm(df, days_ahead)

        return self._forecast_ensemble(df, days_ahead)

    def _prepare_series(self, df):
        series_df = df[['sale_date', 'quantity']].copy()
        series_df = series_df.drop_duplicates(subset=['sale_date'], keep='last').set_index('sale_date')
        series_df = series_df.asfreq('D', fill_value=0)
        series_df['quantity'] = pd.to_numeric(series_df['quantity'], errors='coerce').fillna(0.0)
        series_df = series_df.reset_index()
        return series_df

    def _build_forecast_list(self, df, values, model_type, confidence_base=0.92):
        df_series = self._prepare_series(df)
        last_date = df_series['sale_date'].max()
        last_quantity = df_series['quantity'].iloc[-1] if len(df_series) else 0
        weekly_avg = df_series.groupby(df_series['sale_date'].dt.weekday)['quantity'].mean()
        weekly_mean = weekly_avg.mean() if len(weekly_avg) else 1.0

        forecasts = []
        for i, raw_value in enumerate(values, start=1):
            forecast_date = last_date + timedelta(days=i)
            day_of_week = forecast_date.weekday()
            seasonal_factor = (weekly_avg.get(day_of_week, weekly_mean) / weekly_mean) if weekly_mean else 1.0
            forecasted_demand = max(0, _safe_int(raw_value, default=0))
            confidence = max(0.55, min(0.98, confidence_base - (i * 0.002) - abs(seasonal_factor - 1) * 0.01))
            trend_indicator = 'stable'
            if forecasted_demand > last_quantity * 1.05:
                trend_indicator = 'increasing'
            elif forecasted_demand < last_quantity * 0.95:
                trend_indicator = 'decreasing'

            forecasts.append({
                'date': forecast_date.strftime('%Y-%m-%d'),
                'demand': forecasted_demand,
                'confidence': round(confidence, 2),
                'trend': trend_indicator,
                'seasonality': round(seasonal_factor, 2)
            })

        return forecasts

    def _forecast_baseline(self, df, days_ahead, source='baseline'):
        df_series = self._prepare_series(df)
        if len(df_series) == 0:
            values = [0] * days_ahead
        else:
            window = min(14, len(df_series))
            last_ma = df_series['quantity'].tail(window).mean()
            values = [last_ma] * days_ahead
        return self._build_forecast_list(df, values, source, confidence_base=0.75)

    def _forecast_arima(self, df, days_ahead):
        df_series = self._prepare_series(df)
        if len(df_series) < 8 or not STATS_MODELS_AVAILABLE:
            return self._forecast_baseline(df, days_ahead, source='arima')

        series = df_series['quantity'].astype(float)
        try:
            model = ARIMA(series, order=(1, 1, 1))
            fitted = model.fit()
            predictions = fitted.forecast(steps=days_ahead)
            return self._build_forecast_list(df, predictions, 'arima', confidence_base=0.88)
        except Exception:
            return self._forecast_baseline(df, days_ahead, source='arima')

    def _forecast_prophet(self, df, days_ahead):
        df_series = self._prepare_series(df)
        if len(df_series) < 10 or not PROPHET_AVAILABLE:
            return self._forecast_baseline(df, days_ahead, source='prophet')

        try:
            prophet_df = pd.DataFrame({'ds': df_series['sale_date'], 'y': df_series['quantity']})
            model = Prophet(daily_seasonality=True, weekly_seasonality=True, yearly_seasonality=True, seasonality_mode='additive')
            model.fit(prophet_df)
            future = model.make_future_dataframe(periods=days_ahead, freq='D')
            forecast = model.predict(future)
            predictions = forecast['yhat'].tail(days_ahead).fillna(method='ffill').fillna(method='bfill').values
            return self._build_forecast_list(df, predictions, 'prophet', confidence_base=0.90)
        except Exception:
            return self._forecast_baseline(df, days_ahead, source='prophet')

    def _forecast_random_forest(self, df, days_ahead):
        df_series = self._prepare_series(df)
        values = df_series['quantity'].astype(float).values
        lags = min(14, max(3, len(values) // 2))
        if len(values) < lags + 2:
            return self._forecast_baseline(df, days_ahead, source='random_forest')

        X = []
        y = []
        for idx in range(lags, len(values)):
            X.append(values[idx - lags:idx])
            y.append(values[idx])

        try:
            rf = RandomForestRegressor(n_estimators=100, random_state=42)
            rf.fit(np.array(X), np.array(y))
            predictions = []
            window = list(values[-lags:])
            for _ in range(days_ahead):
                next_pred = rf.predict(np.array(window[-lags:]).reshape(1, -1))[0]
                predictions.append(max(0.0, float(next_pred)))
                window.append(next_pred)
            return self._build_forecast_list(df, predictions, 'random_forest', confidence_base=0.85)
        except Exception:
            return self._forecast_baseline(df, days_ahead, source='random_forest')

    def _forecast_lstm(self, df, days_ahead):
        df_series = self._prepare_series(df)
        values = df_series['quantity'].astype(float).values
        lookback = min(14, max(3, len(values) // 2))
        if len(values) < lookback + 3 or not TF_AVAILABLE:
            return self._forecast_baseline(df, days_ahead, source='lstm')

        try:
            scaler = StandardScaler()
            scaled = scaler.fit_transform(values.reshape(-1, 1))
            X = []
            y = []
            for idx in range(lookback, len(scaled)):
                X.append(scaled[idx - lookback:idx, 0])
                y.append(scaled[idx, 0])

            X = np.array(X).reshape(-1, lookback, 1)
            y = np.array(y)

            tf.keras.backend.clear_session()
            model = tf.keras.Sequential([
                tf.keras.layers.Input(shape=(lookback, 1)),
                tf.keras.layers.LSTM(32, activation='tanh'),
                tf.keras.layers.Dense(1)
            ])
            model.compile(optimizer='adam', loss='mse')
            epochs = min(50, max(10, len(X) // 2))
            model.fit(X, y, epochs=epochs, batch_size=8, verbose=0)

            predictions = []
            window = list(scaled[-lookback:, 0])
            for _ in range(days_ahead):
                seq = np.array(window[-lookback:]).reshape(1, lookback, 1)
                next_pred = model.predict(seq, verbose=0)[0, 0]
                predictions.append(max(0.0, float(scaler.inverse_transform([[next_pred]])[0, 0])))
                window.append(next_pred)

            return self._build_forecast_list(df, predictions, 'lstm', confidence_base=0.89)
        except Exception:
            return self._forecast_baseline(df, days_ahead, source='lstm')

    def _forecast_ensemble(self, df, days_ahead):
        methods = ['arima', 'prophet', 'random_forest', 'lstm']
        candidate_forecasts = {}

        for method in methods:
            try:
                candidate_forecasts[method] = getattr(self, f'_forecast_{method}')(df, days_ahead)
            except Exception:
                candidate_forecasts[method] = self._forecast_baseline(df, days_ahead, source=method)

        combined = []
        for idx in range(days_ahead):
            values = [candidate_forecasts[method][idx]['demand'] for method in methods if len(candidate_forecasts[method]) > idx]
            confidences = [candidate_forecasts[method][idx]['confidence'] for method in methods if len(candidate_forecasts[method]) > idx]
            if not values:
                values = [0]
            avg_demand = float(np.mean(values))
            avg_confidence = float(np.mean(confidences)) if confidences else 0.8
            date = pd.to_datetime(candidate_forecasts[methods[0]][idx]['date']) if candidate_forecasts[methods[0]] else pd.Timestamp.utcnow() + timedelta(days=idx + 1)
            combined.append({
                'date': date.strftime('%Y-%m-%d'),
                'demand': _safe_int(avg_demand),
                'confidence': round(max(0.55, min(0.98, avg_confidence - 0.01)), 2),
                'trend': 'increasing' if avg_demand > df['quantity'].iloc[-1] * 1.05 else 'decreasing' if avg_demand < df['quantity'].iloc[-1] * 0.95 else 'stable',
                'seasonality': round(float(np.mean([candidate_forecasts[method][idx]['seasonality'] for method in methods if len(candidate_forecasts[method]) > idx])), 2)
            })

        return combined

    def _calculate_insights(self, df, forecasts):
        avg_demand = df['quantity'].mean()
        std_demand = df['quantity'].std()
        if pd.isna(std_demand):
            std_demand = 0.0
        forecast_avg = np.mean([f['demand'] for f in forecasts]) if forecasts else 0.0

        n = len(df)
        recent_avg = df.tail(min(7, n))['quantity'].mean()
        older_avg = df.head(max(1, n - 7))['quantity'].mean() if n > 1 else recent_avg
        trend_direction = 'increasing' if recent_avg > older_avg * 1.1 else 'decreasing' if recent_avg < older_avg * 0.9 else 'stable'

        cv = (float(std_demand) / avg_demand) if avg_demand > 0 and not pd.isna(std_demand) else 0
        volatility = 'high' if cv > 0.5 else 'medium' if cv > 0.2 else 'low'

        return {
            'average_historical_demand': round(avg_demand, 2),
            'average_forecasted_demand': round(forecast_avg, 2),
            'demand_volatility': volatility,
            'trend_direction': trend_direction,
            'forecast_confidence': round(np.mean([f['confidence'] for f in forecasts]) if forecasts else 0.0, 2),
            'baseline_method': '7-day moving average',
            'model_count': 4
        }


class OptimizeInventoryView(APIView):
    """
    Inventory optimization endpoint.
    Calculates optimal stock levels and order quantities.
    """
    
    def post(self, request):
        try:
            auth_header = request.headers.get('Authorization', '')
            if auth_header:
                token = auth_header.split(' ')[1] if ' ' in auth_header else None
                if token:
                    try:
                        jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
                    except jwt.InvalidTokenError:
                        return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)

            product_id = request.data.get('product_id')
            current_stock = request.data.get('current_stock', 0)
            reorder_point = request.data.get('reorder_point', 100)
            safety_stock = request.data.get('safety_stock', 50)
            lead_time_days = request.data.get('lead_time_days', 7)
            forecasts = request.data.get('forecasts', [])

            if not product_id:
                return Response({'error': 'product_id is required'}, status=status.HTTP_400_BAD_REQUEST)

            recommendation = self._calculate_optimal_inventory(
                current_stock,
                reorder_point,
                safety_stock,
                lead_time_days,
                forecasts
            )

            return Response({'success': True, 'product_id': product_id, **recommendation}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _calculate_optimal_inventory(self, current_stock, reorder_point, safety_stock, lead_time_days, forecasts):
        if forecasts:
            lead_time_demand = sum([f.get('demand', 0) for f in forecasts[:lead_time_days]])
        else:
            lead_time_demand = reorder_point * (lead_time_days / 7)

        annual_demand_estimate = lead_time_demand * 52
        optimal_order_quantity = max(
            int(np.sqrt(2 * annual_demand_estimate * 100 / 10)),
            int(lead_time_demand * 1.5)
        )

        recommended_stock = max(int(lead_time_demand + safety_stock * 1.5), reorder_point)

        stock_ratio = current_stock / recommended_stock if recommended_stock > 0 else 0

        if current_stock <= safety_stock:
            risk_level = 'critical'
            risk_type = 'shortage'
            reasoning = f'Current stock ({current_stock}) is at or below safety stock ({safety_stock}). Immediate reorder required.'
        elif current_stock < reorder_point:
            risk_level = 'high'
            risk_type = 'shortage'
            reasoning = f'Current stock ({current_stock}) is below reorder point ({reorder_point}). Reorder recommended.'
        elif stock_ratio > 2.0:
            risk_level = 'medium'
            risk_type = 'overstock'
            reasoning = f'Current stock ({current_stock}) is significantly above recommended level ({recommended_stock}). Risk of overstock.'
        elif stock_ratio > 1.5:
            risk_level = 'low'
            risk_type = 'overstock'
            reasoning = f'Current stock ({current_stock}) is above recommended level ({recommended_stock}). Monitor closely.'
        else:
            risk_level = 'low'
            risk_type = 'none'
            reasoning = f'Stock levels are optimal. Current: {current_stock}, Recommended: {recommended_stock}'

        return {
            'recommended_stock': recommended_stock,
            'optimal_order_quantity': optimal_order_quantity,
            'risk_level': risk_level,
            'risk_type': risk_type,
            'reasoning': reasoning,
            'lead_time_demand_estimate': int(lead_time_demand),
            'current_stock_ratio': round(stock_ratio, 2)
        }
