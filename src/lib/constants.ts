/** Site-wide constants; overridable at runtime via SiteSetting keys (seeded from .env defaults). */
export const SITE = {
  name: 'Cozy Furnitures',
  legalName: 'Cozy Furnitures (Pvt.) Ltd.',
  tagline: 'Comfortable, Affordable Furniture for Every Home',
  phone: '+92-42-111-269-926',
  email: 'info@cozyfurnitures.pk',
  whatsapp: '+9242111269926',
  complaintsEmail: 'complaints@cozyfurnitures.pk',
  address: 'Main Boulevard, Gulberg III, Lahore, Pakistan',
  freeShippingNote: 'Free Delivery & Installation Nationwide',
  rating: 4.92,
  ratingCount: '2,500+',
};

export const PAYMENT_METHODS = [
  { value: 'COD', label: 'Cash on Delivery', note: 'Pay when your order arrives' },
  { value: 'CARD', label: 'Credit / Debit Card', note: 'Secure card payment' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', note: 'Direct bank transfer' },
  { value: 'INSTALLMENTS', label: 'Easy Installments', note: 'Buy now, pay in installments' },
] as const;

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

export const PAKISTAN_CITIES = [
  'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Gujranwala', 'Peshawar',
  'Quetta', 'Sialkot', 'Bahawalpur', 'Sargodha', 'Sukkur', 'Abbottabad', 'Hyderabad', 'Other',
];

export const PAKISTAN_PROVINCES = ['Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan', 'Gilgit-Baltistan', 'Azad Kashmir', 'Islamabad Capital Territory'];
