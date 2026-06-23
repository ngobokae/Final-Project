import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import logoSrc from '../assets/IMG_1472.PNG';
import { scrollPageToTop } from '../utils/scrollToTop';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact Us', to: '/contact' },
];

export default function LandingNavbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (to) => () => {
    if (location.pathname === to) {
      scrollPageToTop();
    } else {
      requestAnimationFrame(() => scrollPageToTop());
      setTimeout(scrollPageToTop, 50);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-neutral-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <Link to="/" onClick={handleNavClick('/')} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <img src={logoSrc} alt="KINGLION" className="h-11 w-11 object-cover rounded-lg shadow-md" />
          <div>
            <p className="text-xl font-bold bg-gradient-to-r from-neutral-900 to-red-700 bg-clip-text text-transparent">
              KINGLION
            </p>
            <p className="text-xs font-medium text-red-600">Manufacturing Excellence</p>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={handleNavClick(link.to)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-red-50 text-red-700'
                    : 'text-neutral-600 hover:text-red-700 hover:bg-neutral-50'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <Button
          onClick={() => navigate('/login')}
          className="!bg-gradient-to-r !from-neutral-900 !to-red-700 !text-white hover:!from-black hover:!to-red-800 shadow-lg hover:shadow-xl transition-all duration-300 font-semibold shrink-0"
        >
          Staff Portal <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <div className="md:hidden border-t border-neutral-100 px-4 py-2 flex gap-2 overflow-x-auto">
        {navLinks.map((link) => {
          const active = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={handleNavClick(link.to)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                active ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
