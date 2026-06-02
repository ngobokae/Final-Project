import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Zap, 
  BarChart3, 
  Clock, 
  Shield, 
  Users, 
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/button';
import logoSrc from '../assets/IMG_1472.PNG';

export default function Landing() {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    setIsLoaded(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: BarChart3,
      title: 'Roofing Sheets',
      description: 'Premium quality roofing sheets manufactured to international standards with 150,000MT annual production capacity'
    },
    {
      icon: Zap,
      title: 'Motorcycle Assembly',
      description: 'Professional assembly and wholesale of motorcycles - over 100,000 satisfied customers across Tanzania and Rwanda'
    },
    {
      icon: Clock,
      title: 'Three-Wheeler Manufacturing',
      description: 'Durable three-wheeler assembly and distribution across the East African Community'
    },
    {
      icon: Shield,
      title: 'Printer Cartridges',
      description: 'High-quality printer cartridge manufacturing and supply under the KINGLION brand'
    },
    {
      icon: Users,
      title: 'Solar Energy Solutions',
      description: 'Renewable energy products and solar solutions for sustainable manufacturing'
    },
    {
      icon: TrendingUp,
      title: 'Regional Expansion',
      description: 'Growing operations across Tanzania and Rwanda with facilities in Dar es Salaam and Kigali'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-600/20 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="Logo" className="h-10 w-10 object-cover rounded" />
          <div className="flex flex-col">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              KINGLION
            </span>
            <span className="text-xs text-slate-400">Manufacturing Excellence</span>
          </div>
        </div>
        <Button 
          onClick={() => navigate('/login')}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Staff Login
        </Button>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className={`text-center transform transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-400/30 rounded-full mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-blue-300" />
            <span className="text-sm text-blue-200">Established 2016 • 150,000MT Annual Capacity • EAC Leader</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="block mb-2">Africa's Leading</span>
            <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
              Steel & Assembly Manufacturing
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto mb-12 leading-relaxed">
            KINGLION INVESTMENT COMPANY LIMITED - Proudly manufacturing roofing sheets, motorcycles, three-wheelers, and solar energy solutions across Eastern and Central Africa since 2016. Over 100,000 satisfied customers across Tanzania and Rwanda.
          </p>

          {/* CTA Button */}
          <div className="flex gap-4 justify-center mb-24">
            <Button 
              onClick={() => navigate('/login')}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-6 text-lg group"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg border-slate-400 text-slate-200 hover:bg-slate-700"
            >
              Learn More
            </Button>
          </div>

          {/* Hero Image/Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mb-24 text-center">
            <div className="p-6 bg-slate-700/30 backdrop-blur border border-slate-600 rounded-lg hover:border-blue-400/50 transition-colors">
              <div className="text-3xl font-bold text-blue-300 mb-2">150K MT</div>
              <p className="text-sm text-slate-400">Annual Capacity</p>
            </div>
            <div className="p-6 bg-slate-700/30 backdrop-blur border border-slate-600 rounded-lg hover:border-purple-400/50 transition-colors">
              <div className="text-3xl font-bold text-purple-300 mb-2">100K+</div>
              <p className="text-sm text-slate-400">Proud Owners</p>
            </div>
            <div className="p-6 bg-slate-700/30 backdrop-blur border border-slate-600 rounded-lg hover:border-pink-400/50 transition-colors">
              <div className="text-3xl font-bold text-pink-300 mb-2">40K Sets</div>
              <p className="text-sm text-slate-400">Annual Sales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-32">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Our <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Core Products & Services</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Established in 2016, KINGLION has become Eastern and Central Africa's trusted manufacturer of quality products
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className={`group p-8 bg-slate-700/30 backdrop-blur border border-slate-600 rounded-xl hover:border-blue-400/50 hover:bg-slate-700/50 transition-all duration-500 transform ${
                  isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{
                  transitionDelay: isLoaded ? `${index * 100}ms` : '0ms'
                }}
              >
                <div className="inline-block p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-white">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-24">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 md:p-16 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">Join Our Growing Family</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Access KINGLION's management platform to streamline operations, track inventory, and optimize your manufacturing workflow across our facilities.
          </p>
          <Button 
            onClick={() => navigate('/login')}
            size="lg"
            className="bg-white hover:bg-slate-100 text-blue-600 font-semibold px-8 py-6 text-lg"
          >
            Access Management Dashboard
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-700 mt-24 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-2">KINGLION INVESTMENT COMPANY LIMITED</h3>
              <p className="text-slate-400 text-sm">Eastern and Central Africa's trusted manufacturer of quality steel products, motorcycles, and renewable energy solutions.</p>
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">Tanzania Operations</h3>
              <p className="text-slate-400 text-sm">Dar es Salaam, Tanzania<br/>Since 2016<br/>150,000MT Annual Capacity</p>
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">Rwanda Operations</h3>
              <p className="text-slate-400 text-sm">Kigali, Rwanda<br/>Expanding Since 2022<br/>EAC Market Leader</p>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-8 flex flex-col md:flex-row justify-between items-center text-slate-400">
            <div className="mb-6 md:mb-0">
              <p>&copy; 2016-2026 KINGLION INVESTMENT COMPANY LIMITED. All rights reserved.</p>
            </div>
            <div className="flex gap-8">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Tailwind Animation Styles */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-fade-in {
          animation: fadeIn 1s ease-in-out;
        }
      `}</style>
    </div>
  );
}
