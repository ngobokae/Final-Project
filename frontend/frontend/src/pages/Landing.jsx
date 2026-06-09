import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowRight, 
  Hammer,
  Zap, 
  TrendingUp,
  Shield,
  MapPin,
  Phone,
  Mail,
  Globe,
  CheckCircle2,
  Sparkles,
  Factory
} from 'lucide-react';
import logoSrc from '../assets/IMG_1472.PNG';

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    // Force light mode on landing page - same as login
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
        } catch (e) {
          // Ignore
        }
      }
    };
  }, []);

  const products = [
    {
      icon: Hammer,
      title: 'Roofing Sheets',
      description: 'Premium quality roofing sheets manufactured to international standards with 150,000MT annual production capacity'
    },
    {
      icon: Zap,
      title: 'Motorcycle Assembly',
      description: 'Professional assembly and wholesale - over 100,000 satisfied customers across Tanzania and Rwanda'
    },
    {
      icon: TrendingUp,
      title: 'Three-Wheeler Manufacturing',
      description: 'Durable three-wheeler assembly and distribution across the East African Community'
    },
    {
      icon: Shield,
      title: 'Printer Cartridges',
      description: 'High-quality printer cartridge manufacturing and supply under the KINGLION brand'
    },
    {
      icon: Zap,
      title: 'Solar Energy Solutions',
      description: 'Renewable energy products and solar solutions for sustainable manufacturing'
    },
    {
      icon: TrendingUp,
      title: 'Regional Operations',
      description: 'Growing operations across Tanzania and Rwanda with facilities in Dar es Salaam and Kigali'
    }
  ];

  const stats = [
    { value: '150K MT', label: 'Annual Capacity', highlight: true },
    { value: '100K+', label: 'Proud Customers' },
    { value: '40K Sets', label: 'Annual Sales' },
    { value: '2', label: 'Regional Hubs' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-neutral-50 to-red-50 overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-200 opacity-20 blur-3xl rounded-full animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-neutral-200 opacity-20 blur-3xl rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="relative">
              <img src={logoSrc} alt="KINGLION" className="h-12 w-12 object-cover rounded-lg shadow-md" />
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent rounded-lg"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-neutral-900 to-red-700 bg-clip-text text-transparent">KINGLION</h1>
              <p className="text-xs font-medium text-red-600">Manufacturing Excellence</p>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/login')}
            className="!bg-gradient-to-r !from-neutral-900 !to-red-700 !text-white hover:!from-black hover:!to-red-800 shadow-lg hover:shadow-xl transition-all duration-300 font-semibold"
          >
            Staff Portal <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="space-y-6 relative z-10">
            {/* Badge */}
            <div className="inline-block">
              <div className="px-4 py-2 bg-gradient-to-r from-red-50 to-neutral-50 border-2 border-red-200 rounded-full text-sm font-bold text-red-700 flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow w-fit">
                <Sparkles className="w-4 h-4" />
                East Africa's Industry Leader
              </div>
            </div>

            {/* Main Heading */}
            <div className="space-y-3">
              <h1 className="text-5xl md:text-6xl font-black leading-tight text-neutral-900">
                Africa's Premier <br />
                <span className="bg-gradient-to-r from-red-600 via-red-500 to-neutral-900 bg-clip-text text-transparent">Steel & Assembly</span> Manufacturer
              </h1>
            </div>

            {/* Description */}
            <p className="text-base md:text-lg text-neutral-700 leading-relaxed max-w-xl font-medium">
              KINGLION INVESTMENT COMPANY LIMITED since <span className="font-bold text-neutral-900">2016</span>. Trusted by over <span className="font-bold text-red-700">100,000 customers</span> across Tanzania and Rwanda. Manufacturing excellence with <span className="font-bold text-red-700">150,000MT annual capacity</span>.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-3">
              {[
                'Roofing Sheets & Steel',
                'Motorcycle Assembly',
                'Three-Wheeler Manufacturing',
                'Solar Energy Solutions'
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <div className="flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-red-600 group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-sm text-neutral-800 font-semibold group-hover:text-red-700 transition-colors">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={() => navigate('/login')}
                size="lg"
                className="!bg-gradient-to-r !from-neutral-900 !to-red-700 !text-white hover:!from-black hover:!to-red-800 shadow-xl hover:shadow-2xl transition-all duration-300 text-sm h-14 font-bold group"
              >
                Access Dashboard
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                onClick={() => document.getElementById('products').scrollIntoView({ behavior: 'smooth' })}
                size="lg"
                className="border-2 border-red-300 text-neutral-900 hover:bg-red-50 shadow-lg hover:shadow-xl transition-all duration-300 text-sm h-14 font-bold"
              >
                Explore Solutions
              </Button>
            </div>
          </div>

          {/* Right: Logo & Visual */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-full">
              {/* Glowing background */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-400/20 to-neutral-400/20 blur-3xl rounded-full"></div>
              
              {/* Main Logo Card */}
              <div className="relative bg-gradient-to-br from-white to-neutral-50 rounded-2xl shadow-2xl border border-neutral-200/50 p-8 hover:shadow-3xl transition-shadow duration-300">
                <div className="flex items-center justify-center min-h-72">
                  <img src={logoSrc} alt="KINGLION" className="h-64 w-auto object-contain drop-shadow-2xl" />
                </div>
              </div>

              {/* Floating Badges */}
              <div className="absolute -top-4 -right-4 bg-white shadow-lg rounded-xl p-4 border-2 border-red-200 animate-bounce" style={{ animationDelay: '0s' }}>
                <p className="text-2xl font-black bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">150K</p>
                <p className="text-xs font-bold text-neutral-600 mt-1 uppercase tracking-wide">MT Capacity</p>
              </div>
              
              <div className="absolute -bottom-4 -left-4 bg-white shadow-lg rounded-xl p-4 border-2 border-red-200 animate-bounce" style={{ animationDelay: '0.3s' }}>
                <p className="text-2xl font-black bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">100K+</p>
                <p className="text-xs font-bold text-neutral-600 mt-1 uppercase tracking-wide">Customers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid Below */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-14">
          {[
            { label: 'Annual Capacity', value: '150K MT', icon: '⚙️' },
            { label: 'Proud Customers', value: '100K+', icon: '👥' },
            { label: 'Established', value: '2016', icon: '📅' }
          ].map((stat, idx) => (
            <div key={idx} className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="bg-white border-2 border-neutral-200 group-hover:border-red-300 rounded-lg p-6 text-center transition-all duration-300">
                <div className="text-3xl mb-2">{stat.icon}</div>
                <p className="text-3xl md:text-4xl font-black bg-gradient-to-r from-neutral-900 to-red-700 bg-clip-text text-transparent">{stat.value}</p>
                <p className="text-xs font-bold text-neutral-600 mt-2 uppercase tracking-wide">{stat.label}</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg"></div>
            </div>
          ))}
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
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg"></div>
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
            {/* Tanzania */}
            <div className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">
              <Card className="border-0 shadow-lg !bg-white hover:border-red-200 border-2 border-transparent h-full">
                <CardHeader className="!pb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gradient-to-br from-red-50 to-neutral-50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                      <Globe className="w-5 h-5 text-red-700" />
                    </div>
                    <CardTitle className="!text-xl !text-neutral-900">Tanzania</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-l-4 border-red-500 pl-3">
                    <p className="font-bold text-base text-neutral-900">Dar es Salaam</p>
                    <p className="text-xs text-red-600 font-semibold">Headquarters & Main Manufacturing Plant</p>
                  </div>
                  <div className="space-y-2 bg-neutral-50 -mx-6 px-6 py-3 rounded-lg">
                    <div>
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Est. 2016</p>
                      <p className="text-xs text-neutral-700 font-medium">KINGLION Founded</p>
                    </div>
                    <div className="border-t border-neutral-200 pt-2">
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Capacity</p>
                      <p className="text-xs text-neutral-700 font-medium">150,000MT per annum</p>
                    </div>
                    <div className="border-t border-neutral-200 pt-2">
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Specialization</p>
                      <p className="text-xs text-neutral-700 font-medium">Roofing sheets, Motorcycles, Three-wheelers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Rwanda */}
            <div className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5">
              <Card className="border-0 shadow-lg !bg-white hover:border-red-200 border-2 border-transparent h-full">
                <CardHeader className="!pb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gradient-to-br from-red-50 to-neutral-50 rounded-lg group-hover:scale-110 transition-transform duration-300">
                      <Globe className="w-5 h-5 text-red-700" />
                    </div>
                    <CardTitle className="!text-xl !text-neutral-900">Rwanda</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-l-4 border-red-500 pl-3">
                    <p className="font-bold text-base text-neutral-900">Kigali</p>
                    <p className="text-xs text-red-600 font-semibold">Regional Assembly & Distribution Hub</p>
                  </div>
                  <div className="space-y-2 bg-neutral-50 -mx-6 px-6 py-3 rounded-lg">
                    <div>
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Est. 2022</p>
                      <p className="text-xs text-neutral-700 font-medium">EAC Market Expansion</p>
                    </div>
                    <div className="border-t border-neutral-200 pt-2">
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Focus</p>
                      <p className="text-xs text-neutral-700 font-medium">Regional growth & distribution</p>
                    </div>
                    <div className="border-t border-neutral-200 pt-2">
                      <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide mb-1">Role</p>
                      <p className="text-xs text-neutral-700 font-medium">EAC Market Leader</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Network Map Info */}
          <div className="bg-gradient-to-r from-red-50 to-neutral-50 border-2 border-red-200 rounded-lg p-6 text-center">
            <h3 className="text-base font-bold text-neutral-900 mb-1">Expanding Across East Africa</h3>
            <p className="text-xs text-neutral-600 font-medium max-w-2xl mx-auto">
              Connected operations across Tanzania and Rwanda with strategic growth in the East African Community region
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-16 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-red-900 to-neutral-900"></div>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-500 blur-3xl rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-neutral-600 blur-3xl rounded-full"></div>
        </div>

        <div className="relative max-w-4xl mx-auto px-6 text-center space-y-5">
          <div className="space-y-3">
            <h2 className="text-4xl md:text-5xl font-black text-white">
              Ready to <span className="bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent">Optimize</span> Your Operations?
            </h2>
            <p className="text-base text-neutral-200 max-w-2xl mx-auto font-medium">
              Access KINGLION's powerful management platform to streamline operations, track inventory, forecast demand, and maximize efficiency.
            </p>
          </div>

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

      {/* Footer */}
      <footer className="bg-neutral-950 text-neutral-400 border-t border-neutral-800/50">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-8">
            {/* Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <img src={logoSrc} alt="KINGLION" className="h-8 w-8 object-cover rounded-lg" />
                <div>
                  <h3 className="font-bold text-white text-sm">KINGLION</h3>
                  <p className="text-xs text-red-400">Est. 2016</p>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-neutral-400">
                Africa's trusted manufacturer of quality steel products, motorcycles, and renewable energy solutions.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-white mb-2 text-sm">Navigation</h4>
              <ul className="space-y-1 text-xs">
                {['Products', 'About Us', 'Facilities', 'Contact'].map((link, idx) => (
                  <li key={idx}>
                    <a href="#" className="text-neutral-400 hover:text-red-400 transition-colors duration-200">{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Facilities */}
            <div>
              <h4 className="font-bold text-white mb-2 text-sm">Locations</h4>
              <ul className="space-y-1 text-xs">
                <li className="text-neutral-400">📍 Dar es Salaam, Tanzania</li>
                <li className="text-neutral-400">📍 Kigali, Rwanda</li>
                <li className="text-neutral-400">🌍 EAC Region</li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold text-white mb-2 text-sm">Connect</h4>
              <ul className="space-y-1 text-xs">
                <li className="text-neutral-400">✉️ info@kinglion.co.tz</li>
                <li className="text-neutral-400">📞 +250788809111</li>
                <li className="text-neutral-400">🌐 www.kinglion.co.tz</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-neutral-800/50 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-neutral-500">
            <p>&copy; 2016-2026 KINGLION INVESTMENT COMPANY LIMITED. All rights reserved.</p>
            <div className="flex gap-6 mt-3 md:mt-0">
              <a href="#" className="hover:text-neutral-300 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-neutral-300 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-neutral-300 transition-colors">Compliance</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
