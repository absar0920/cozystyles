/**
 * The test data for the browser walkthrough. Every section uses these exact names, so later sections
 * (menus, layouts, storefront) can find what earlier ones created by name — never by database id.
 * Photo paths are relative to the project folder (they ship with the repo).
 */

export const STORE = {
  whatsapp: '0300 1234567', // placeholder test number — replace with the shop's real WhatsApp in Settings
  whatsappStored: '923001234567',
  announcement: 'Free delivery & installation across Pakistan',
  announcementButton: 'Shop sofas',
  phone: '042-111-269-269',
  email: 'hello@cozystyle.pk',
  address: 'Plot 12, Main Boulevard\nGulberg III, Lahore',
  facebook: 'https://facebook.com/cozystyle.pk',
  instagram: 'https://instagram.com/cozystyle.pk',
};

export type CollectionData = { title: string; handle: string; parent?: string; description: string; cover: string };

export const COLLECTIONS: CollectionData[] = [
  { title: 'Living Room', handle: 'living-room', description: 'Sofas, coffee tables and accent chairs for the heart of your home.', cover: 'public/images/collections/living.jpg' },
  { title: 'Sofas', handle: 'sofas', parent: 'Living Room', description: 'Two and three seater sofas in fabrics that last.', cover: 'public/images/collections/antonin.webp' },
  { title: 'Coffee Tables', handle: 'coffee-tables', parent: 'Living Room', description: 'Solid wood centre and coffee tables.', cover: 'public/images/collections/center-table.jpg' },
  { title: 'Bedroom', handle: 'bedroom', description: 'Beds and bedside tables crafted in solid wood.', cover: 'public/images/collections/bedroom.jpg' },
  { title: 'Beds', handle: 'beds', parent: 'Bedroom', description: 'King and queen size beds.', cover: 'public/images/collections/camelot.webp' },
  { title: 'Bedside Tables', handle: 'bedside-tables', parent: 'Bedroom', description: 'Bedside tables with soft-close drawers.', cover: 'public/images/collections/bed-side-tables.jpg' },
  { title: 'Dining', handle: 'dining', description: 'Dining sets for four to eight people.', cover: 'public/images/collections/coalesce-dining.jpg' },
  { title: 'Office Chairs', handle: 'office-chairs', description: 'Ergonomic manager and visitor chairs.', cover: 'public/images/collections/ceo-chairs.webp' },
];

export type VariantData = { values: string[]; regular: string; sale?: string; status: 'Ready to ship' | 'Made to order' | 'Pre-order' | 'Sold out' };
export type ProductData = {
  title: string;
  handle: string;
  description: string;
  photos: string[];
  collections: string[];
  /** Products without options: one price/status. */
  regular?: string;
  sale?: string;
  status?: VariantData['status'];
  /** Products with options. */
  options?: { name: string; values: string[]; swatches?: Record<string, string> }[];
  variants?: VariantData[];
  /** "Shows" tag per photo index (e.g. { 0: 'Color: Grey' }). */
  photoTags?: Record<number, string>;
  delivery?: string;
  newArrival?: boolean;
  limitedEdition?: boolean;
  draft?: boolean;
};

export const PRODUCTS: ProductData[] = [
  {
    title: 'Antonin Sofa',
    handle: 'antonin-sofa',
    description:
      'A modern sofa with deep seats, kiln-dried hardwood frame and tapered brass-finish legs. Available as a 3 or 2 seater in two fabrics.',
    photos: ['public/images/products/antonin-sofa-1.jpg', 'public/images/products/antonin-sofa-2.webp', 'public/images/products/antonin-sofa-3.webp'],
    collections: ['Living Room', 'Sofas'],
    options: [
      { name: 'Size', values: ['3 Seater', '2 Seater'] },
      { name: 'Color', values: ['Grey', 'Beige'], swatches: { Grey: '#8a8d91', Beige: '#d8c7a8' } },
    ],
    variants: [
      { values: ['3 Seater', 'Grey'], regular: '185000', sale: '165000', status: 'Ready to ship' },
      { values: ['2 Seater', 'Grey'], regular: '145000', status: 'Ready to ship' },
      { values: ['3 Seater', 'Beige'], regular: '185000', sale: '165000', status: 'Made to order' },
      { values: ['2 Seater', 'Beige'], regular: '145000', status: 'Made to order' },
    ],
    photoTags: { 0: 'Color: Grey', 1: 'Color: Beige' },
    delivery: 'Delivered in 20 to 30 working days',
    newArrival: true,
  },
  {
    title: 'Alexa Sofa Chair',
    handle: 'alexa-sofa-chair',
    description: 'A plush accent chair in premium velvet on solid wood legs.',
    photos: ['public/images/products/alexa-sofa-chair-1.jpg', 'public/images/products/alexa-sofa-chair-2.jpg'],
    collections: ['Living Room', 'Sofas'],
    regular: '45000',
    sale: '39000',
    status: 'Ready to ship',
    limitedEdition: true,
  },
  {
    title: 'Arbour Coffee Table',
    handle: 'arbour-coffee-table',
    description: 'Solid sheesham coffee table with a lower shelf.',
    photos: ['public/images/products/arbour-coffee-table-1.jpg'],
    collections: ['Living Room', 'Coffee Tables'],
    regular: '32000',
    status: 'Ready to ship',
  },
  {
    title: 'Alpen Bed',
    handle: 'alpen-bed',
    description: 'Solid wood bed with an upholstered headboard.',
    photos: ['public/images/products/alpen-bed-1.jpg', 'public/images/products/alpen-bed-2.png'],
    collections: ['Bedroom', 'Beds'],
    options: [{ name: 'Size', values: ['King', 'Queen'] }],
    variants: [
      { values: ['King'], regular: '120000', status: 'Ready to ship' },
      { values: ['Queen'], regular: '105000', status: 'Ready to ship' },
    ],
    delivery: 'Delivered in 15 to 20 working days',
  },
  {
    title: 'Aura Bedside Table',
    handle: 'aura-bedside-table',
    description: 'Two-drawer bedside table with soft-close runners.',
    photos: ['public/images/products/aura-bedside-table-1.jpg', 'public/images/products/aura-bedside-table-2.jpg'],
    collections: ['Bedroom', 'Bedside Tables'],
    regular: '18500',
    status: 'Made to order',
  },
  {
    title: 'Arbour Dining Set',
    handle: 'arbour-dining-set',
    description: 'Six-seater dining table with matching chairs. Taking pre-orders for the next production batch.',
    photos: ['public/images/products/arbour-dining-table-set-1.jpg'],
    collections: ['Dining'],
    regular: '210000',
    status: 'Pre-order',
  },
  {
    title: 'Apex Manager Chair',
    handle: 'apex-manager-chair',
    description: 'High-back ergonomic manager chair with lumbar support and tilt lock.',
    photos: ['public/images/products/apex-manager-chair-with-headrest-1.jpg', 'public/images/products/apex-manager-chair-without-headrest-1.jpg'],
    collections: ['Office Chairs'],
    options: [{ name: 'Headrest', values: ['With headrest', 'Without headrest'] }],
    variants: [
      { values: ['With headrest'], regular: '38000', status: 'Ready to ship' },
      { values: ['Without headrest'], regular: '34000', status: 'Sold out' },
    ],
  },
  {
    title: 'Prototype Side Table',
    handle: 'prototype-side-table',
    description: 'Not ready for sale yet.',
    photos: ['public/images/products/antonin-side-table-1.jpg'],
    collections: ['Living Room'],
    regular: '15000',
    status: 'Ready to ship',
    draft: true,
  },
];

export const LAYOUT = {
  name: 'Sofa showcase',
  description: 'Sofas and accent chairs',
  overlayPhoto: 'public/images/landing/home-furniture-banner.jpg',
  overlayHeading: 'Made for long evenings',
  imageTextPhoto: 'public/images/products/antonin-sofa-4.webp',
  imageTextHeading: 'Built on a solid hardwood frame',
  imageTextBody: 'Every frame is kiln-dried and hand-joined in our Lahore workshop.',
  imageTextButton: 'See all sofas',
  icons: [
    { title: 'Free delivery', text: 'Delivery and installation across Pakistan' },
    { title: '1-year warranty', text: 'On frames and upholstery' },
    { title: 'Made in Pakistan', text: 'Crafted in our own workshop' },
  ],
  quotes: [
    { text: 'The sofa arrived on time and looks even better than the photos.', name: 'Ayesha K., Lahore' },
    { text: 'Comfortable, solid and the fabric is easy to clean.', name: 'Bilal A., Karachi' },
  ],
  featuredHeading: 'More from our sofa range',
  featuredCollection: 'Sofas',
  products: ['Antonin Sofa', 'Alexa Sofa Chair'],
};

export const BANNERS = [
  { name: 'Living room sale', desktop: 'public/images/landing/home-furniture-banner.jpg', phone: 'public/images/products/alexa-sofa-chair-1.jpg', link: 'Living Room', visible: true },
  { name: 'Sleep better', desktop: 'public/images/collections/bedroom.jpg', phone: undefined, link: 'Beds', visible: true },
  { name: 'Office ready', desktop: 'public/images/collections/ceo-chairs.webp', phone: undefined, link: 'Office Chairs', visible: true },
  { name: 'Coming soon: dining', desktop: 'public/images/collections/coalesce-dining.jpg', phone: undefined, link: 'Dining', visible: false },
];

export const MENUS = {
  main: [
    { label: 'Living Room', link: 'Living Room', children: ['Sofas', 'Coffee Tables'] },
    { label: 'Bedroom', link: 'Bedroom', children: ['Beds', 'Bedside Tables'] },
    { label: 'Dining', link: 'Dining', children: [] as string[] },
    { label: 'Office Chairs', link: 'Office Chairs', children: [] as string[] },
    { label: 'Blog', link: 'Blog', children: [] as string[] },
  ],
  footerAbout: [{ label: 'About Us', link: 'About Us' }, { label: 'Terms & Conditions', link: 'Terms & Conditions' }],
  footerSupport: [{ label: 'Shipping & Delivery', link: 'Shipping & Delivery' }, { label: 'Returns & Exchanges', link: 'Returns & Exchanges' }, { label: 'Privacy Policy', link: 'Privacy Policy' }],
  popular: [{ label: 'Sofas', link: 'Sofas' }, { label: 'Beds', link: 'Beds' }, { label: 'Office chairs', link: 'Office Chairs' }],
};

export const PAGES = [
  { title: 'About Us', handle: 'about-us', body: 'Cozy Furnitures designs and makes furniture for Pakistani homes. Every piece is built in our Lahore workshop from kiln-dried hardwood.' },
  { title: 'Privacy Policy', handle: 'privacy-policy', body: 'We collect your name and phone number only to answer your WhatsApp order and deliver your furniture. We never sell your data.' },
  { title: 'Shipping & Delivery', handle: 'shipping-delivery', body: 'Free delivery and installation in Lahore, Karachi and Islamabad. Other cities: delivery charges are confirmed on WhatsApp.' },
  { title: 'Returns & Exchanges', handle: 'returns-exchanges', body: 'Report any damage within 48 hours of delivery and we will repair or replace the item.' },
  { title: 'Terms & Conditions', handle: 'terms-conditions', body: 'Orders are confirmed on WhatsApp. Prices are in Pakistani rupees and include sales tax.' },
];

export const BLOG_POSTS = [
  {
    title: 'How to Choose the Right Sofa',
    body: 'Measure your room first, then think about seating, fabric and frame.',
    subheading: 'Measure twice',
    subheadingBody: 'Leave at least 18 inches between the sofa and the coffee table.',
    author: 'Cozy Furnitures',
    photo: 'public/images/blog/10-creative-ways-to-arrange-your-living-room-furniture.jpg',
    tags: ['Sofas', 'Living Room'],
  },
  {
    title: 'Small Bedroom Ideas',
    body: 'A king bed can work in a small room: keep bedside tables slim and use wall lights.',
    subheading: 'Go vertical',
    subheadingBody: 'Tall wardrobes and wall shelves free up floor space.',
    author: 'Cozy Furnitures',
    photo: 'public/images/blog/selecting-your-furniture-together-a-complete-guide-for-couples-for-this-wedding-season.jpg',
    tags: ['Bedroom'],
  },
];

export const SHOPPER = {
  contact: { name: 'Hamza Ali', email: 'hamza.ali@example.com', phone: '0321 7654321', message: 'Do you deliver to Multan? I want the Antonin Sofa in grey.' },
  newsletterEmail: 'sana.malik@example.com',
  search: 'sofa',
};

/** Admin password used while testing "Change password" (changed back afterwards). */
export const TEMP_ADMIN_PASSWORD = 'Cozy-Walkthrough-2026!';
