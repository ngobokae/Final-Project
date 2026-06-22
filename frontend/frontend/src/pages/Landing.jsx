import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import LandingNavbar from '../components/LandingNavbar';
import LandingFooter from '../components/LandingFooter';
import {
  ArrowRight,
  Hammer,
  Zap,
  TrendingUp,
  Shield,
  MapPin,
  Globe,
  CheckCircle2,
  Sparkles,
  Factory,
  Layers,
  Truck,
} from 'lucide-react';
import logoSrc from '../assets/IMG_1472.PNG';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');

    const observer = new MutationObserver(() => {
      if (root.classList.contains('dark')) {
        root.classList.remove('dark');
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user.theme === 'dark') {
            root.classList.add('dark');
          }
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const products = [
    {
      icon: Hammer,
      title: 'Roofing Sheets',
      description: 'Premium quality roofing sheets manufactured to international standards for residential and commercial projects.',
    },
    {
      icon: Zap,
      title: 'Motorcycle Assembly',
      description: 'Professional assembly and wholesale distribution across Tanzania and Rwanda.',
    },
    {
      icon: TrendingUp,
      title: 'Three-Wheeler Manufacturing',
      description: 'Durable three-wheeler assembly and distribution across the East African Community.',
    },
    {
      icon: Shield,
      title: 'Printer Cartridges',
      description: 'High-quality printer cartridge manufacturing and supply under the KINGLION brand.',
    },
    {
      icon: Zap,
      title: 'Solar Energy Solutions',
      description: 'Renewable energy products and solar solutions for sustainable manufacturing.',
    },
    {
      icon: Truck,
      title: 'Regional Operations',
      description: 'Integrated supply and distribution across Tanzania and Rwanda.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-neutral-50 to-red-50 overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-200 opacity-20 blur-3xl rounded-full animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-neutral-200 opacity-20 blur-3xl rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <LandingNavbar />

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 py-14 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div className="space-y-7 relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 border border-red-100 rounded-full text-sm font-bold text-red-700 shadow-sm">
              <Sparkles className="w-4 h-4" />
              East Africa&apos;s Industry Leader
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-black leading-[1.1] text-neutral-900">
                Africa&apos;s Premier{' '}
                <span className="bg-gradient-to-r from-red-600 via-red-500 to-neutral-900 bg-clip-text text-transparent">
                  Steel &amp; Assembly
                </span>{' '}
                Manufacturer
              </h1>
              <p className="text-base md:text-lg text-neutral-600 leading-relaxed max-w-xl">
                KINGLION INVESTMENT COMPANY LIMITED delivers trusted manufacturing, assembly, and supply chain
                excellence across Tanzania and Rwanda — from roofing and mobility to renewable energy solutions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                'Roofing Sheets & Steel',
                'Motorcycle Assembly',
                'Three-Wheeler Manufacturing',
                'Solar Energy Solutions',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 rounded-lg bg-white/70 border border-neutral-100 px-3 py-2.5">
                  <CheckCircle2 className="w-5 h-5 text-red-600 shrink-0" />
                  <span className="text-sm text-neutral-800 font-semibold">{feature}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={() => navigate('/login')}
                size="lg"
                className="!bg-gradient-to-r !from-neutral-900 !to-red-700 !text-white hover:!from-black hover:!to-red-800 shadow-xl hover:shadow-2xl transition-all duration-300 text-sm h-14 font-bold group"
              >
                Access Dashboard
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                size="lg"
                variant="outline"
                className="border-2 border-red-200 text-neutral-900 hover:bg-red-50 shadow-lg hover:shadow-xl transition-all duration-300 text-sm h-14 font-bold"
              >
                Explore Solutions
              </Button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-red-300/20 via-transparent to-neutral-300/20 blur-3xl rounded-full" />
            <div className="relative w-full max-w-lg">
              <div className="rounded-3xl border border-white/70 bg-white/90 backdrop-blur-sm shadow-2xl p-10 md:p-12">
                <div className="rounded-2xl bg-gradient-to-br from-neutral-50 to-red-50/40 p-8 flex items-center justify-center min-h-[280px]">
                  <img src={logoSrc} alt="KINGLION" className="h-52 w-auto object-contain drop-shadow-xl" />
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 py-3 px-2">
                    <Layers className="w-5 h-5 text-red-600 mx-auto mb-1" />
                    <p className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Steel</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 py-3 px-2">
                    <Factory className="w-5 h-5 text-red-600 mx-auto mb-1" />
                    <p className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Assembly</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 py-3 px-2">
                    <Globe className="w-5 h-5 text-red-600 mx-auto mb-1" />
                    <p className="text-[11px] font-bold text-neutral-700 uppercase tracking-wide">Regional</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="relative bg-gradient-to-b from-white to-neutral-50/50 py-16 md:py-20 border-t border-neutral-200/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200/50 rounded-full mb-4">
              <Factory className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-red-700 uppercase">Our Products</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-neutral-900 mb-4">
              Comprehensive <span className="bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">Solutions</span>
            </h2>
            <p className="text-base text-neutral-600 max-w-2xl mx-auto font-medium">
              Quality manufacturing and assembly across Eastern and Central Africa
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((product, idx) => {
              const Icon = product.icon;
              return (
                <div key={idx} className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">
                  <Card className="border-0 shadow-lg !bg-white h-full hover:border-red-200 border-2 border-transparent">
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="p-3 bg-gradient-to-br from-red-50 to-neutral-50 rounded-lg w-fit group-hover:scale-110 transition-transform duration-300">
                          <Icon className="w-6 h-6 text-red-700" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-neutral-900 mb-1 group-hover:text-red-700 transition-colors">{product.title}</h3>
                          <p className="text-xs text-neutral-600 leading-relaxed">{product.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Facilities Section */}
      <section className="relative py-16 md:py-20 bg-gradient-to-b from-neutral-50/50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200/50 rounded-full mb-4">
              <MapPin className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-red-700 uppercase">Global Presence</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-neutral-900 mb-4">
              Regional <span className="bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">Operations</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card className="border-0 shadow-lg !bg-white h-full">
              <CardHeader className="!pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-br from-red-50 to-neutral-50 rounded-lg">
                    <Globe className="w-5 h-5 text-red-700" />
                  </div>
                  <CardTitle className="!text-xl !text-neutral-900">Tanzania</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-l-4 border-red-500 pl-3">
                  <p className="font-bold text-base text-neutral-900">Dar es Salaam</p>
                  <p className="text-xs text-red-600 font-semibold">Headquarters &amp; Main Manufacturing Plant</p>
                </div>
                <div className="space-y-2 bg-neutral-50 -mx-6 px-6 py-3 rounded-lg text-xs text-neutral-700">
                  <p>Full-scale steel, roofing, and mobility production.</p>
                  <p>Primary hub for KINGLION manufacturing and export operations.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg !bg-white h-full">
              <CardHeader className="!pb-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-br from-red-50 to-neutral-50 rounded-lg">
                    <Globe className="w-5 h-5 text-red-700" />
                  </div>
                  <CardTitle className="!text-xl !text-neutral-900">Rwanda</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-l-4 border-red-500 pl-3">
                  <p className="font-bold text-base text-neutral-900">Kigali</p>
                  <p className="text-xs text-red-600 font-semibold">Regional Assembly &amp; Distribution Hub</p>
                </div>
                <div className="space-y-2 bg-neutral-50 -mx-6 px-6 py-3 rounded-lg text-xs text-neutral-700">
                  <p>Regional assembly, distribution, and market support.</p>
                  <p>Strategic gateway for East African Community growth.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-red-900 to-neutral-900" />
        <div className="relative max-w-4xl mx-auto px-6 text-center space-y-5">
          <h2 className="text-4xl md:text-5xl font-black text-white">
            Ready to <span className="bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent">Optimize</span> Your Operations?
          </h2>
          <p className="text-base text-neutral-200 max-w-2xl mx-auto font-medium">
            Access KINGLION&apos;s management platform to streamline operations, track inventory, forecast demand, and maximize efficiency.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button
              onClick={() => navigate('/login')}
              size="lg"
              className="!bg-white !text-neutral-900 hover:!bg-neutral-100 shadow-lg hover:shadow-xl transition-all duration-300 text-sm h-14 font-bold group"
            >
              Access Staff Portal
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
