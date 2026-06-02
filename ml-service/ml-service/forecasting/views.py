from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import jwt
from django.conf import settings
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import json


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
            # Validate JWT token if provided
            auth_header = request.headers.get('Authorization', '')
            if auth_header:
                token = auth_header.split(' ')[1] if ' ' in auth_header else None
                if token:
                    try:
                        jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
                    except jwt.InvalidTokenError:
                        return Response(
                            {'error': 'Invalid token'},
                            status=status.HTTP_401_UNAUTHORIZED
                        )

            product_id = request.data.get('product_id')
            historical_data = request.data.get('historical_data', [])
            days_ahead = request.data.get('days_ahead', 30)
            model_type = request.data.get('model_type', 'ensemble')

            if not product_id:
                return Response(
                    {'error': 'product_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if len(historical_data) < 1:
                return Response(
                    {'error': 'Insufficient historical data. Need at least 1 data point'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Convert to DataFrame
            df = pd.DataFrame(historical_data)
            df['sale_date'] = pd.to_datetime(df['sale_date'])
            df = df.sort_values('sale_date')
            df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')
            df = df.dropna(subset=['quantity'])

            if len(df) < 1:
                return Response(
                    {'error': 'Insufficient valid data points'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Generate forecast
            forecasts = self._generate_forecast(df, days_ahead, model_type)
            
            # Calculate insights
            insights = self._calculate_insights(df, forecasts)

            return Response({
                'success': True,
                'product_id': product_id,
                'model_type': model_type,
                'forecasts': forecasts,
                'insights': insights
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _generate_forecast(self, df, days_ahead, model_type='ensemble'):
        """Generate demand forecast using time series analysis.
        
        Note: This service supports multiple model types. For now, the core logic is shared,
        but parameters differ slightly per model to keep behavior consistent and explainable.
        """
        forecasts = []
        
        # Prepare data for modeling
        df['day_of_week'] = df['sale_date'].dt.dayofweek
        df['day_of_month'] = df['sale_date'].dt.day
        df['month'] = df['sale_date'].dt.month
        
        # Create time index
        df['time_index'] = range(len(df))
        
        # Simple moving average (adjusted per model)
        if model_type == 'lstm':
            base_window = 14
        elif model_type == 'prophet':
            base_window = 7
        else:
            base_window = 10  # ensemble / default

        window = min(base_window, max(2, len(df) // 2))
        df['ma'] = df['quantity'].rolling(window=window, min_periods=1).mean()
        
        # Trend detection
        X = df[['time_index']].values
        y = df['quantity'].values
        
        model = LinearRegression()
        model.fit(X, y)
        trend_slope = model.coef_[0]
        
        # Seasonality detection (weekly pattern)
        weekly_avg = df.groupby('day_of_week')['quantity'].mean()
        seasonality_factor = weekly_avg.mean() / weekly_avg.max() if weekly_avg.max() > 0 else 1.0
        
        # Generate forecasts
        last_date = df['sale_date'].max()
        last_quantity = df['quantity'].iloc[-1]
        last_ma = df['ma'].iloc[-1]
        
        for i in range(1, days_ahead + 1):
            forecast_date = last_date + timedelta(days=i)
            day_of_week = forecast_date.weekday()
            
            # Base forecast using moving average
            base_forecast = last_ma
            
            # Apply trend
            if model_type == 'prophet':
                trend_adjustment = trend_slope * i * 0.9
            elif model_type == 'lstm':
                trend_adjustment = trend_slope * i * 1.1
            else:
                trend_adjustment = trend_slope * i
            
            # Apply seasonality
            seasonal_factor = weekly_avg.get(day_of_week, weekly_avg.mean()) / weekly_avg.mean() if weekly_avg.mean() > 0 else 1.0
            
            # Calculate forecasted demand
            raw_forecast = base_forecast + trend_adjustment * seasonal_factor

            # Simple "ensemble": blend moving average and last observed quantity
            if model_type == 'ensemble':
                raw_forecast = (0.75 * raw_forecast) + (0.25 * last_quantity)

            forecasted_demand = max(0, int(raw_forecast))
            
            # Confidence level (decreases over time)
            decay = 0.008 if model_type == 'lstm' else 0.01
            confidence = max(0.5, 0.95 - (i * decay))
            
            # Trend indicator
            if trend_slope > 0.1:
                trend_indicator = 'increasing'
            elif trend_slope < -0.1:
                trend_indicator = 'decreasing'
            else:
                trend_indicator = 'stable'
            
            forecasts.append({
                'date': forecast_date.strftime('%Y-%m-%d'),
                'demand': forecasted_demand,
                'confidence': round(confidence, 2),
                'trend': trend_indicator,
                'seasonality': round(seasonal_factor, 2)
            })

        return forecasts

    def _calculate_insights(self, df, forecasts):
        """Calculate insights from historical data and forecasts."""
        avg_demand = df['quantity'].mean()
        std_demand = df['quantity'].std()
        if pd.isna(std_demand):
            std_demand = 0.0
        forecast_avg = np.mean([f['demand'] for f in forecasts])

        # Trend analysis (safe for 1–2 rows)
        n = len(df)
        recent_avg = df.tail(min(7, n))['quantity'].mean()
        older_avg = df.head(max(1, n - 7))['quantity'].mean() if n > 1 else recent_avg
        trend_direction = 'increasing' if recent_avg > older_avg * 1.1 else 'decreasing' if recent_avg < older_avg * 0.9 else 'stable'
        
        # Volatility (std can be NaN for single row)
        cv = (float(std_demand) / avg_demand) if avg_demand > 0 and not pd.isna(std_demand) else 0
        volatility = 'high' if cv > 0.5 else 'medium' if cv > 0.2 else 'low'
        
        return {
            'average_historical_demand': round(avg_demand, 2),
            'average_forecasted_demand': round(forecast_avg, 2),
            'demand_volatility': volatility,
            'trend_direction': trend_direction,
            'forecast_confidence': round(np.mean([f['confidence'] for f in forecasts]), 2)
        }


class OptimizeInventoryView(APIView):
    """
    Inventory optimization endpoint.
    Calculates optimal stock levels and order quantities.
    """
    
    def post(self, request):
        try:
            # Validate JWT token if provided
            auth_header = request.headers.get('Authorization', '')
            if auth_header:
                token = auth_header.split(' ')[1] if ' ' in auth_header else None
                if token:
                    try:
                        jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
                    except jwt.InvalidTokenError:
                        return Response(
                            {'error': 'Invalid token'},
                            status=status.HTTP_401_UNAUTHORIZED
                        )

            product_id = request.data.get('product_id')
            current_stock = request.data.get('current_stock', 0)
            reorder_point = request.data.get('reorder_point', 100)
            safety_stock = request.data.get('safety_stock', 50)
            lead_time_days = request.data.get('lead_time_days', 7)
            forecasts = request.data.get('forecasts', [])

            if not product_id:
                return Response(
                    {'error': 'product_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Calculate optimal inventory levels
            recommendation = self._calculate_optimal_inventory(
                current_stock,
                reorder_point,
                safety_stock,
                lead_time_days,
                forecasts
            )

            return Response({
                'success': True,
                'product_id': product_id,
                **recommendation
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _calculate_optimal_inventory(self, current_stock, reorder_point, safety_stock, lead_time_days, forecasts):
        """Calculate optimal inventory levels and identify risks."""
        
        # Calculate expected demand during lead time
        if forecasts:
            lead_time_demand = sum([f.get('demand', 0) for f in forecasts[:lead_time_days]])
        else:
            # Fallback calculation
            lead_time_demand = reorder_point * (lead_time_days / 7)
        
        # Economic Order Quantity (EOQ) approximation
        # Using simplified formula: sqrt(2 * annual_demand * ordering_cost / holding_cost)
        # For simplicity, we'll use a multiplier based on lead time demand
        annual_demand_estimate = lead_time_demand * 52  # Approximate annual from weekly
        optimal_order_quantity = max(
            int(np.sqrt(2 * annual_demand_estimate * 100 / 10)),  # Simplified EOQ
            int(lead_time_demand * 1.5)  # Minimum based on lead time
        )
        
        # Recommended stock level
        recommended_stock = max(
            int(lead_time_demand + safety_stock * 1.5),
            reorder_point
        )
        
        # Risk assessment
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
