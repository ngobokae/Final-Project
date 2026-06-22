import { useState } from 'react';
import { Link } from 'react-router-dom';
import LandingNavbar from '../components/LandingNavbar';
import LandingFooter from '../components/LandingFooter';
import { Button } from '../components/ui/button';
import {
  ArrowRight,
  Building2,
  Clock,
  Globe,
  Headphones,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Truck,
  Users,
} from 'lucide-react';

const departments = [
  {
    icon: Building2,
    title: 'General Enquiries',
    email: 'info@kinglion.co.tz',
    text: 'Product information, partnerships, and company questions.',
  },
  {
    icon: Truck,
    title: 'Sales & Distribution',
    email: 'info@kinglion.co.tz',
    text: 'Wholesale orders, regional supply, and delivery coordination.',
  },
  {
    icon: Headphones,
    title: 'Customer Support',
    email: 'info@kinglion.co.tz',
    text: 'After-sales support, service requests, and account assistance.',
  },
];

const offices = [
  {
    city: 'Dar es Salaam',
    country: 'Tanzania',
    role: 'Headquarters & Main Manufacturing Plant',
    details: 'Primary production hub for steel, roofing, mobility, and branded goods.',
    hours: 'Mon – Fri, 8:00 AM – 5:00 PM',
  },
  {
    city: 'Kigali',
    country: 'Rwanda',
    role: 'Regional Assembly & Distribution Hub',
    details: 'Assembly, distribution, and East African Community market operations.',
    hours: 'Mon – Fri, 8:00 AM – 5:00 PM',
  },
];

export default function ContactUs() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`
    );
    const subject = encodeURIComponent(form.subject || 'KINGLION Website Enquiry');
    window.location.href = `mailto:info@kinglion.co.tz?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 via-white to-red-50/20">
      <LandingNavbar />

      <section className="relative overflow-hidden border-b border-neutral-200/60">
        <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 via-white to-neutral-50" />
        <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-600 mb-3">Contact Us</p>
            <h1 className="text-4xl md:text-6xl font-black text-neutral-900 leading-tight mb-5">
              Let&apos;s start a{' '}
              <span className="bg-gradient-to-r from-red-600 to-neutral-900 bg-clip-text text-transparent">
                conversation
              </span>
            </h1>
            <p className="text-lg text-neutral-600 leading-relaxed">
              Reach our teams for sales, partnerships, support, or general enquiries. We respond to business
              messages during working hours across Tanzania and Rwanda.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-12">
          <a href="mailto:info@kinglion.co.tz" className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <Mail className="w-6 h-6 text-red-600 mb-3" />
            <p className="text-xs font-bold uppercase text-neutral-500 mb-1">Email</p>
            <p className="font-semibold text-neutral-900 text-sm">info@kinglion.co.tz</p>
          </a>
          <a href="tel:+250788809111" className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <Phone className="w-6 h-6 text-red-600 mb-3" />
            <p className="text-xs font-bold uppercase text-neutral-500 mb-1">Phone</p>
            <p className="font-semibold text-neutral-900 text-sm">+250 788 809 111</p>
          </a>
          <a href="https://www.kinglion.co.tz" target="_blank" rel="noreferrer" className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <Globe className="w-6 h-6 text-red-600 mb-3" />
            <p className="text-xs font-bold uppercase text-neutral-500 mb-1">Website</p>
            <p className="font-semibold text-neutral-900 text-sm">www.kinglion.co.tz</p>
          </a>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <Clock className="w-6 h-6 text-red-600 mb-3" />
            <p className="text-xs font-bold uppercase text-neutral-500 mb-1">Business Hours</p>
            <p className="font-semibold text-neutral-900 text-sm">Mon – Fri, 8:00 AM – 5:00 PM</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 rounded-3xl border border-neutral-200 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="w-6 h-6 text-red-600" />
              <div>
                <h2 className="text-2xl font-black text-neutral-900">Send a Message</h2>
                <p className="text-sm text-neutral-500">Fill in the form and your email app will open ready to send.</p>
              </div>
            </div>

            {submitted ? (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-emerald-800">
                <p className="font-semibold mb-1">Thank you for reaching out.</p>
                <p className="text-sm">Your email client should have opened. If it did not, write to info@kinglion.co.tz directly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
                    <input
                      required
                      value={form.name}
                      onChange={handleChange('name')}
                      className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Email Address</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={handleChange('email')}
                      className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="you@company.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Subject</label>
                  <input
                    required
                    value={form.subject}
                    onChange={handleChange('subject')}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="How can we help?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={handleChange('message')}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-y"
                    placeholder="Tell us about your enquiry..."
                  />
                </div>
                <Button type="submit" className="!bg-gradient-to-r !from-neutral-900 !to-red-700 !text-white h-11 px-6 font-bold">
                  Send Message <Send className="w-4 h-4 ml-2" />
                </Button>
              </form>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-neutral-900">Departments</h3>
              </div>
              <div className="space-y-4">
                {departments.map((dept) => {
                  const Icon = dept.icon;
                  return (
                    <div key={dept.title} className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-neutral-900 text-sm">{dept.title}</p>
                          <p className="text-xs text-neutral-600 mt-1">{dept.text}</p>
                          <a href={`mailto:${dept.email}`} className="text-xs text-red-700 font-medium mt-2 inline-block hover:underline">
                            {dept.email}
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-neutral-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-black mb-8">Our Offices</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {offices.map((office) => (
              <div key={office.city} className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <MapPin className="w-5 h-5 text-red-400 mt-1 shrink-0" />
                  <div>
                    <h3 className="text-xl font-bold">{office.city}, {office.country}</h3>
                    <p className="text-red-300 text-sm font-medium mt-1">{office.role}</p>
                  </div>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed mb-4">{office.details}</p>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <Clock className="w-4 h-4" />
                  {office.hours}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="rounded-3xl bg-gradient-to-r from-red-600 to-red-800 p-8 md:p-10 text-center text-white">
          <h2 className="text-2xl md:text-3xl font-black mb-3">Need operational access?</h2>
          <p className="text-red-100 max-w-xl mx-auto mb-6">
            Staff members can sign in to the KINGLION management platform for inventory, forecasting, and reporting.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center h-12 px-6 rounded-md bg-white text-red-800 font-bold hover:bg-neutral-100 transition-colors"
          >
            Go to Staff Portal <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
