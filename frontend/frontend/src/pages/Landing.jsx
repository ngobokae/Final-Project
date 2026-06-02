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
  Globe
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
    <div className="min-h-screen bg-gradient-to-br from-white via-neutral-50 to-red-100/60">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-neutral-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoSrc} alt="KINGLION" className="h-10 w-10 object-cover rounded" />
            <div>
              <h1 className="text-xl font-bold text-neutral-900">KINGLION</h1>
              <p className="text-xs text-neutral-500">Manufacturing Excellence</p>
            </div>
          </div>
          <Button 
            onClick={() => navigate('/login')}
            className="!bg-gradient-to-r !from-neutral-900 !to-red-800 !text-white hover:!from-black hover:!to-red-900"
          >
            Staff Portal
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <div className="space-y-6">
            <div className="inline-block">
              <span className="px-4 py-2 bg-gradient-to-r from-red-100 to-neutral-100 border border-red-200 rounded-full text-sm font-medium text-red-700">
                ✓ Eastern & Central Africa Leader
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-neutral-900 leading-tight">
              Africa's Premier <span className="text-gradient bg-gradient-to-r from-red-600 to-neutral-900 bg-clip-text text-transparent">Steel & Assembly</span> Manufacturer
            </h1>

            <p className="text-lg text-neutral-600 leading-relaxed max-w-2xl">
              KINGLION INVESTMENT COMPANY LIMITED - Established 2016. Manufacturing roofing sheets, motorcycles, three-wheelers, printer cartridges, and solar energy solutions with 150,000MT annual capacity. Over 100,000 satisfied customers across Tanzania and Rwanda.
            </p>

            <div className="flex gap-4 pt-4">
              <Button 
                onClick={() => navigate('/login')}
                size="lg"
                className="!bg-gradient-to-r !from-neutral-900 !to-red-800 !text-white hover:!from-black hover:!to-red-900 shadow-lg"
              >
                Access Dashboard
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                onClick={() => document.getElementById('products').scrollIntoView({ behavior: 'smooth' })}
                size="lg"
                variant="outline"
                className="border-neutral-300 text-neutral-700 hover:bg-neutral-50"
              >
                Learn More
              </Button>
            </div>
          </div>

          {/* Right: Logo & Stats */}
          <div className="space-y-8">
            <Card className="shadow-xl border-0 !bg-white">
              <CardContent className="pt-8 flex justify-center">
                <img src={logoSrc} alt="KINGLION" className="h-48 w-auto object-contain" />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
          {stats.map((stat, idx) => (
            <Card key={idx} className={`border-0 shadow-md ${stat.highlight ? '!bg-gradient-to-br !from-red-50 !to-neutral-50 border border-red-200' : '!bg-white'}`}>
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-neutral-900 mb-1">{stat.value}</div>
                <p className="text-sm text-neutral-600">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Products Section */}
      <section id="products" className="bg-white py-16 md:py-24 border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
              Our Products & Services
            </h2>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              Comprehensive manufacturing and assembly solutions across Eastern and Central Africa
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, idx) => {
              const Icon = product.icon;
              return (
                <Card key={idx} className="border-0 shadow-md hover:shadow-lg transition-shadow hover:border-red-200 border border-neutral-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gradient-to-br from-red-100 to-neutral-100 rounded-lg">
                        <Icon className="w-6 h-6 text-red-700" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-neutral-900 mb-1">{product.title}</h3>
                        <p className="text-sm text-neutral-600">{product.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Facilities Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-white via-neutral-50 to-red-100/60">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-neutral-900 mb-12 text-center">
            Our Facilities
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Tanzania */}
            <Card className="border-0 shadow-lg !bg-white">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Globe className="w-6 h-6 text-red-700" />
                  <CardTitle className="!text-neutral-900">Tanzania Operations</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold text-neutral-900">Dar es Salaam</p>
                  <p className="text-sm text-neutral-600">Headquarters & Main Manufacturing Plant</p>
                </div>
                <div className="border-t border-neutral-200 pt-3">
                  <p className="text-sm text-neutral-600"><span className="font-medium text-neutral-900">Established:</span> 2016</p>
                  <p className="text-sm text-neutral-600"><span className="font-medium text-neutral-900">Capacity:</span> 150,000MT per annum</p>
                  <p className="text-sm text-neutral-600"><span className="font-medium text-neutral-900">Products:</span> Roofing sheets, Motorcycles, Three-wheelers</p>
                </div>
              </CardContent>
            </Card>

            {/* Rwanda */}
            <Card className="border-0 shadow-lg !bg-white">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Globe className="w-6 h-6 text-red-700" />
                  <CardTitle className="!text-neutral-900">Rwanda Operations</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold text-neutral-900">Kigali</p>
                  <p className="text-sm text-neutral-600">Regional Assembly & Distribution Hub</p>
                </div>
                <div className="border-t border-neutral-200 pt-3">
                  <p className="text-sm text-neutral-600"><span className="font-medium text-neutral-900">Established:</span> 2022</p>
                  <p className="text-sm text-neutral-600"><span className="font-medium text-neutral-900">Focus:</span> Market Expansion</p>
                  <p className="text-sm text-neutral-600"><span className="font-medium text-neutral-900">Role:</span> EAC Market Leader</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-neutral-900 via-red-900 to-neutral-900 py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-4xl font-bold text-white">
            Ready to Optimize Your Operations?
          </h2>
          <p className="text-lg text-neutral-200 max-w-2xl mx-auto">
            Access KINGLION's management platform to streamline operations, track inventory, and maximize efficiency across all facilities.
          </p>
          <div className="pt-4">
            <Button 
              onClick={() => navigate('/login')}
              size="lg"
              className="!bg-white !text-neutral-900 hover:!bg-neutral-100 font-semibold shadow-lg"
            >
              Staff Portal Login
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 text-neutral-300 border-t border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-8">
            <div className="space-y-2">
              <h3 className="font-bold text-white">KINGLION INVESTMENT COMPANY LIMITED</h3>
              <p className="text-sm leading-relaxed">
                Africa's trusted manufacturer of quality steel products, motorcycles, and renewable energy solutions.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#products" className="hover:text-white transition-colors">Products</a></li>
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Locations</h4>
              <ul className="space-y-2 text-sm">
                <li>Dar es Salaam, Tanzania</li>
                <li>Kigali, Rwanda</li>
                <li>EAC Region Operations</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-neutral-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm">
            <p>&copy; 2016-2026 KINGLION INVESTMENT COMPANY LIMITED. All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
