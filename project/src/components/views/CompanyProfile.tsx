import { useState, useEffect } from 'react';
import { Building2, Save, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CompanyProfileData {
  id?: string;
  company_name: string;
  gst_number: string;
  pan_number: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  whatsapp_number: string;
  whatsapp_api_token: string;
  whatsapp_phone_number_id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  terms_conditions: string;
  logo_url: string;
}

export function CompanyProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profile, setProfile] = useState<CompanyProfileData>({
    company_name: '',
    gst_number: '',
    pan_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
    phone: '',
    email: '',
    website: '',
    whatsapp_number: '',
    whatsapp_api_token: '',
    whatsapp_phone_number_id: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    terms_conditions: 'Payment due within 30 days',
    logo_url: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('company_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setMessage({ type: 'error', text: 'Failed to load company profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const profileData = { ...profile, user_id: user.id };

      if (profile.id) {
        const { error } = await supabase
          .from('company_profile')
          .update(profileData)
          .eq('id', profile.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_profile')
          .insert([profileData])
          .select()
          .single();

        if (error) throw error;
        setProfile({ ...profile, id: data.id });
      }

      setMessage({ type: 'success', text: 'Company profile saved successfully!' });
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: 'Failed to save company profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof CompanyProfileData, value: string) => {
    setProfile({ ...profile, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-3 rounded-xl">
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Company Profile</h1>
          <p className="text-slate-600">Manage your business information and invoice settings</p>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 space-y-6">
          <div className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={profile.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="ABC Enterprises Pvt Ltd"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  GST Number
                </label>
                <input
                  type="text"
                  value={profile.gst_number}
                  onChange={(e) => handleChange('gst_number', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  PAN Number
                </label>
                <input
                  type="text"
                  value={profile.pan_number}
                  onChange={(e) => handleChange('pan_number', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="AAAAA0000A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Business Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="info@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={profile.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="https://www.company.com"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={profile.whatsapp_number}
                  onChange={(e) => handleChange('whatsapp_number', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="919876543210"
                />
                <p className="mt-1 text-xs text-slate-500">Enter with country code (e.g., 919876543210 for India)</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">WhatsApp Business API</h2>
            <p className="text-sm text-slate-600 mb-4">
              Configure Meta WhatsApp Business API for automatic message sending.
              <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                Get your credentials here
              </a>
            </p>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  WhatsApp API Token
                </label>
                <input
                  type="password"
                  value={profile.whatsapp_api_token}
                  onChange={(e) => handleChange('whatsapp_api_token', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                  placeholder="EAAxxxxxxxxxx"
                />
                <p className="mt-1 text-xs text-slate-500">Your permanent access token from Meta Business</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={profile.whatsapp_phone_number_id}
                  onChange={(e) => handleChange('whatsapp_phone_number_id', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                  placeholder="123456789012345"
                />
                <p className="mt-1 text-xs text-slate-500">The Phone Number ID from your WhatsApp Business API dashboard</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Address</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={profile.address_line1}
                  onChange={(e) => handleChange('address_line1', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="123 Business Street"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={profile.address_line2}
                  onChange={(e) => handleChange('address_line2', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Suite 100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={profile.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Mumbai"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={profile.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Maharashtra"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={profile.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="400001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Country
                </label>
                <input
                  type="text"
                  value={profile.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="India"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Banking Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={profile.bank_name}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="State Bank of India"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  value={profile.account_number}
                  onChange={(e) => handleChange('account_number', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={profile.ifsc_code}
                  onChange={(e) => handleChange('ifsc_code', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="SBIN0001234"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Invoice Settings</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Terms & Conditions
              </label>
              <textarea
                value={profile.terms_conditions}
                onChange={(e) => handleChange('terms_conditions', e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Payment due within 30 days. Late payments subject to 2% monthly interest."
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-xl flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Profile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
