/**
 * The live homepage Judge.me "cards carousel" shows the store's featured reviews, in this order.
 * Static on purpose: the local Review table is synthetic and doesn't contain these.
 * Photos are the reviewers' own (public/images/reviews/home-rNN.*).
 */
export type HomeReview = {
  image: string | null;
  body: string;
  author: string;
  productTitle: string;
  href: string;
  /** Live shows Judge.me's verified-buyer badge only for verified reviewers (default true). */
  verified?: boolean;
};

const img = (n: string, ext: 'jpg' | 'png' = 'jpg') => `/images/reviews/home-r${n}.${ext}`;

export const HOME_REVIEWS: HomeReview[] = [
  { image: img('01'), body: 'great quality and design.', author: 'Anonymous', productTitle: 'Callisto Computer Table', href: '/products/callisto-computer-table' },
  {
    image: img('02'),
    body: 'A very durable look. A long lasting feel. A comfort beyond imagination. A price I would have never imagined. A service that no other competitor in the market could offer. Thanks you Cozy Furnitures!!',
    author: 'Khurram Ilyas',
    productTitle: 'Faith Sofa Cum Bed',
    href: '/collections/sofas-all',
    verified: false,
  },
  {
    image: img('03'),
    body: 'Excellent make quality and very comfortable for Extended working hours',
    author: 'Aadil Mirza',
    // Judge.me truncates long product names server-side, with two dots.
    productTitle: 'Marlon Manager High Back..',
    href: '/collections/office-chairs',
  },
  { image: img('04'), body: 'Great experience with Cozy Furnitures interior. Best in town.', author: 'Haroon Nasir', productTitle: 'Conte Sofa', href: '/products/conte-sofa' },
  {
    image: img('05'),
    body: "The quality is top-notch. I really love the chair. It's size is very suitable for a minimalist outlook of my workspace.",
    author: 'Saadat',
    productTitle: 'Dawn Manager Chair',
    href: '/products/dawn-manager-chair',
  },
  { image: img('06', 'png'), body: 'Excellent', author: 'Anonymous', productTitle: 'Aria Manager Chair', href: '/products/aria-manager-chair' },
  { image: img('07'), body: 'very nice and unique design ..', author: 'Anonymous', productTitle: 'Ozone 2.0 Center Table', href: '/products/ozone-2-center-table' },
  {
    image: img('08'),
    body: 'The quality of the study table and Chair is extraordinary. The price is also very competitive.',
    author: 'Saad Bin Asif',
    productTitle: 'Millie Study Desk',
    href: '/products/millie-study-desk',
  },
  {
    image: img('09'),
    body: 'I have received the sofa today. The quality is wonderful, it fits my exact specifications, and it’s very comfortable. Thank you for the smooth process and great service!',
    author: 'Anonymous',
    productTitle: 'Alexa Sofa Chair',
    href: '/products/alexa-sofa-chair',
    verified: false,
  },
  {
    image: img('10'),
    body: 'I like it 👌🏻cool cozy furniture',
    author: 'Ommama',
    productTitle: 'Jasper Modular Sofa',
    href: '/products/jasper-sofa-2-seater',
    verified: false,
  },
  { image: img('11'), body: 'great', author: 'Sabahat Siddiqui', productTitle: 'Pinnacle Executive Chair', href: '/products/pinnacle-executive-chair' },
  {
    image: img('12', 'png'),
    body: 'Nice and Comfortable',
    author: 'Muhammad Awais',
    productTitle: 'Pulse Manager Chair (With Headrest)',
    href: '/products/pulse-manager-chair-with-headrest-grey-black',
  },
  {
    image: img('13', 'png'),
    body: 'The Chair is very comfortable, I’m satisfied with the quality and comfort',
    author: 'Waleed Ahmed',
    productTitle: 'Pulse Manager Chair (With Headrest)',
    href: '/products/pulse-manager-chair-with-headrest-grey-black',
  },
  {
    image: img('14'),
    body: 'Look great in the bedroom, the grey adds a touch of modernity. Extremely spacious so will fit all the essentials.',
    author: 'Zaineb',
    productTitle: 'Quest Chest Of Drawers',
    href: '/products/crf-chest-of-drawers',
  },
  { image: img('15'), body: 'Great', author: 'Anonymous', productTitle: 'Spire Manager Chair', href: '/products/manager-chair-spire' },
  { image: null, body: 'Wonderful product and great service like always', author: 'Sehrish', productTitle: 'Cozy Furnitures', href: '/' },
  {
    image: img('16'),
    body: 'Exactly as functional and utilitarian like it is in the picture. One half is for compartments and the rest of the wardrobe has a hanging rod, and there are three roomy shelfs in the bottom. There is plenty of space for a persons stuff.',
    author: 'Zaineb',
    productTitle: 'Cresta Grand Wardrobe (3 Door)',
    href: '/products/cresta-grand-wardrobe-3-doors',
  },
  {
    image: img('17'),
    body: 'Great quality, just what i was looking for in a very good price',
    author: 'Areej Zubair',
    productTitle: 'Callisto Computer Table',
    href: '/products/callisto-computer-table',
  },
  {
    image: img('12', 'png'),
    body: 'I think the chair is great. Comfortable. Slightly adjustable. Gives a nice clean professional look. Perfect for the average sized man.',
    author: 'Sannan Tariq',
    productTitle: 'Pulse Manager Chair (With Headrest)',
    href: '/products/pulse-manager-chair-with-headrest-grey-black',
  },
  {
    image: img('18'),
    body: 'They are beautiful and have elevated the whole look of my room.',
    author: 'Anonymous',
    productTitle: 'Quest Bedside Table',
    href: '/products/bedside-table-crf-in-chestnut-and-grey-colour',
  },
  { image: img('19', 'png'), body: 'Its a stunning piece!', author: 'Zaineb', productTitle: 'Sienna Center Table', href: '/products/center-table-antico' },
];
