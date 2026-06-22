import { Link } from 'react-router-dom';
import LandingNavbar from '../components/LandingNavbar';
import LandingFooter from '../components/LandingFooter';
import {
  ArrowRight,
  Award,
  Building2,
  Factory,
  Globe,
  HeartHandshake,
  Leaf,
  Shield,
  Target,
  Users,
  Wrench,
} from 'lucide-react';

const values = [
  { icon: Shield, title: 'Quality First', text: 'Every product line is built around durable materials, strict checks, and consistent output.' },
  { icon: HeartHandshake, title: 'Customer Trust', text: 'Long-term partnerships across Tanzania and Rwanda drive how we design, produce, and deliver.' },
  { icon: Leaf, title: 'Sustainable Growth', text: 'Solar and energy solutions support cleaner operations and smarter manufacturing choices.' },
  { icon: Users, title: 'People & Teams', text: 'Skilled teams across production, logistics, and management keep operations running smoothly.' },
];

const capabilities = [
  { icon: Factory, title: 'Steel & Roofing Production', text: 'Roofing sheets and steel products for residential, commercial, and industrial use.' },
  { icon: Wrench, title: 'Mobility Assembly', text: 'Motorcycle and three-wheeler assembly with regional wholesale distribution.' },
  { icon: Building2, title: 'Regional Supply Chain', text: 'Integrated procurement, inventory, and distribution across East Africa.' },
  { icon: Award, title: 'Brand Manufacturing', text: 'Printer cartridges and branded products under the KINGLION name.' },
];

const milestones = [
  { year: '2016', title: 'Company Founded', text: 'KINGLION established in Tanzania with a focus on steel and manufacturing.' },
  { year: 'Growth', title: 'Product Expansion', text: 'Added motorcycle assembly, three-wheelers, cartridges, and solar solutions.' },
  { year: 'Regional', title: 'Rwanda Operations', text: 'Opened the Kigali hub for assembly, distribution, and EAC market support.' },
  { year: 'Today', title: 'Digital Operations', text: 'Modern platform for inventory, forecasting, procurement, and executive reporting.' },
];

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 via-white to-red-50/30">
      <LandingNavbar />

      <section className="relative overflow-hidden border-b border-neutral-200/60">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50/60 via-white to-neutral-50" />
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-600 mb-3">About KINGLION</p>
            <h1 className="text-4xl md:text-6xl font-black text-neutral-900 leading-tight mb-5">
              Building Africa&apos;s industrial future with{' '}
              <span className="bg-gradient-to-r from-red-600 to-neutral-900 bg-clip-text text-transparent">
                trusted manufacturing
              </span>
            </h1>
            <p className="text-lg text-neutral-600 leading-relaxed">
              KINGLION INVESTMENT COMPANY LIMITED is a multi-product manufacturer serving Tanzania, Rwanda,
              and the wider East African Community. From roofing and mobility to renewable energy, we combine
              production strength with modern operational systems.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <Target className="w-8 h-8 text-red-600 mb-4" />
            <h2 className="text-2xl font-black text-neutral-900 mb-3">Our Mission</h2>
            <p className="text-neutral-600 leading-relaxed">
              To deliver reliable, high-quality manufactured products while strengthening regional supply chains
              and helping businesses operate with confidence across East Africa.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <Globe className="w-8 h-8 text-red-600 mb-4" />
            <h2 className="text-2xl font-black text-neutral-900 mb-3">Our Vision</h2>
            <p className="text-neutral-600 leading-relaxed">
              To become the most trusted manufacturing and assembly partner in the region — known for quality,
              scale, innovation, and operational excellence.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-neutral-200/70 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900">What We Stand For</h2>
            <p className="text-neutral-600 mt-3 max-w-2xl mx-auto">The principles behind every product, partnership, and facility.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {values.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-6 hover:shadow-lg transition-shadow">
                  <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-red-700" />
                  </div>
                  <h3 className="font-bold text-neutral-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-neutral-600 leading-relaxed">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-neutral-900">Core Capabilities</h2>
            <p className="text-neutral-600 mt-3 max-w-2xl">End-to-end manufacturing and distribution built for regional scale.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {capabilities.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-50 to-neutral-100 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-red-700" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-neutral-600 leading-relaxed">{item.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-neutral-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-black mb-10">Our Journey</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {milestones.map((item) => (
              <div key={item.title} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
                <p className="text-red-400 text-sm font-bold uppercase tracking-wide mb-2">{item.year}</p>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-r from-neutral-900 via-red-900 to-neutral-900 p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Partner With KINGLION</h2>
          <p className="text-neutral-200 max-w-2xl mx-auto mb-8">
            Whether you need product supply, regional distribution, or operational support, our team is ready to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center h-12 px-6 rounded-md bg-white text-neutral-900 font-bold hover:bg-neutral-100 transition-colors"
            >
              Contact Us <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
