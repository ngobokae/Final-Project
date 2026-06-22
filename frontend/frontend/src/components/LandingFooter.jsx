import { Link } from 'react-router-dom';
import logoSrc from '../assets/IMG_1472.PNG';

export default function LandingFooter() {
  return (
    <footer className="bg-neutral-950 text-neutral-400 border-t border-neutral-800/50">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img src={logoSrc} alt="KINGLION" className="h-8 w-8 object-cover rounded-lg" />
              <div>
                <h3 className="font-bold text-white text-sm">KINGLION</h3>
                <p className="text-xs text-red-400">Est. 2016</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-neutral-400">
              Africa&apos;s trusted manufacturer of quality steel products, motorcycles, and renewable energy solutions.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white mb-2 text-sm">Navigation</h4>
            <ul className="space-y-1 text-xs">
              <li>
                <Link to="/about" className="text-neutral-400 hover:text-red-400 transition-colors duration-200">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-neutral-400 hover:text-red-400 transition-colors duration-200">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-2 text-sm">Locations</h4>
            <ul className="space-y-1 text-xs">
              <li className="text-neutral-400">Dar es Salaam, Tanzania</li>
              <li className="text-neutral-400">Kigali, Rwanda</li>
              <li className="text-neutral-400">East African Community</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-2 text-sm">Connect</h4>
            <ul className="space-y-1 text-xs">
              <li>
                <a href="mailto:info@kinglion.co.tz" className="text-neutral-400 hover:text-red-400 transition-colors">
                  info@kinglion.co.tz
                </a>
              </li>
              <li>
                <a href="tel:+250788809111" className="text-neutral-400 hover:text-red-400 transition-colors">
                  +250 788 809 111
                </a>
              </li>
              <li>
                <a href="https://www.kinglion.co.tz" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-red-400 transition-colors">
                  www.kinglion.co.tz
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-800/50 pt-6 text-xs text-neutral-500 text-center md:text-left">
          <p>&copy; 2016-2026 KINGLION INVESTMENT COMPANY LIMITED. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
