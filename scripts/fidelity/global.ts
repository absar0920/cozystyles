/**
 * Global chrome fidelity data (live interwood.pk → Cozy Furnitures).
 *
 * Idempotent: replaces the MAIN / FOOTER_1 / FOOTER_2 / FOOTER_SEO menus, removes the menus the
 * live site does not have (FOOTER_3, TOPBAR) and upserts the announcement settings.
 *
 *   npx tsx scripts/fidelity/global.ts
 *
 * prisma/seed.ts imports the same data, so a fresh `npm run db:seed` is already faithful.
 *
 * MAIN menu encoding (rendered by src/components/layout/menu.ts):
 *  - level-2 node with children = mega-menu column heading; without children = plain link
 *  - badge "STACK" = heading rendered in the same column, under the previous group
 *  - label "" + href "" = empty 30px spacer row (live Wardrobes / Flooring dropdowns)
 */
import { PrismaClient } from '@prisma/client';

export type MenuSpec = { label: string; href: string; badge?: string; children?: MenuSpec[] };

export const MAIN_MENU: MenuSpec[] = [
  { label: "Wedding Packages", href: "/pages/wedding-package-builder" },
  { label: "Home", href: "/pages/home-furniture", children: [
    { label: "Bedroom", href: "/collections/bedroom", children: [
      { label: "Bed Sets", href: "/collections/beds" },
      { label: "Bedside Tables", href: "/collections/bed-side-tables" },
      { label: "Dressing Tables", href: "/collections/dressing-tables" },
      { label: "Wall Mirrors", href: "/collections/wall-mirrors" },
      { label: "Free-Standing Wardrobes", href: "/collections/wardrobes" },
      { label: "Clothes Stands", href: "/collections/cloth-stands" },
    ] },
    { label: "Living", href: "/collections/living", children: [
      { label: "Sofa Sets", href: "/collections/sofas-all" },
      { label: "Sofa Beds", href: "/collections/sofa-cum-bed" },
      { label: "Sofa Chairs", href: "/collections/sofa-chair" },
    ] },
    { label: "Dining", href: "/collections/dining", children: [
      { label: "Dining Table Sets", href: "/collections/dining-table-set" },
      { label: "Dining Chairs", href: "/collections/dining-chairs" },
      { label: "Dining Trolleys", href: "/collections/dining-trolleys" },
      { label: "Bar Stools", href: "/collections/bar-stools" },
    ] },
    { label: "Seating", href: "/collections/seating", children: [
      { label: "Occasional Chairs", href: "/collections/occasional-chairs" },
      { label: "Ottomans, Stools & Benches", href: "/collections/ottomans-stools-benches" },
    ] },
    { label: "Recliners", href: "/collections/recliners", badge: "STACK", children: [
      { label: "Power", href: "/collections/power" },
      { label: "Power Lift Assist", href: "/collections/power-lift" },
      { label: "Manual", href: "/collections/manual" },
    ] },
    { label: "Kids", href: "/collections/kids", children: [
      { label: "Kids Single Beds", href: "/collections/single-beds" },
      { label: "Kids Bunk Beds", href: "/collections/bunk-beds" },
      { label: "Kids Bedside Tables", href: "/collections/kids-bedside-tables" },
      { label: "Kids Wardrobes", href: "/collections/kids-wardrobe" },
      { label: "Kids Study Tables, Chairs & Storage", href: "/collections/kids-study-tables-and-chairs" },
    ] },
    { label: "Study", href: "/collections/study", children: [
      { label: "Study Tables & Chairs", href: "/collections/study-tables" },
    ] },
    { label: "Tables", href: "/collections/tables", children: [
      { label: "Center Tables", href: "/collections/center-table" },
      { label: "Side & End Tables", href: "/collections/side-end-tables" },
      { label: "Nested Tables", href: "/collections/nested-tables" },
    ] },
    { label: "Storage", href: "/collections/living-storage", children: [
      { label: "TV Units", href: "/collections/tv-units" },
      { label: "Racks & Shelves", href: "/collections/bookshelves" },
    ] },
  ] },
  { label: "Office", href: "/pages/office-furniture", children: [
    { label: "Office Tables", href: "/collections/office-tables", children: [
      { label: "Manager Tables", href: "/collections/manager-tables" },
      { label: "Executive Tables", href: "/collections/executive-tables" },
      { label: "Side Racks", href: "/collections/side-racks" },
      { label: "Center Tables", href: "/collections/office-center-tables" },
      { label: "Side Tables", href: "/collections/sofa-side-tables" },
      { label: "Reception Counters", href: "/collections/reception-counters" },
      { label: "Meeting Tables", href: "/collections/meeting-tables" },
    ] },
    { label: "Office Chairs", href: "/collections/office-chairs", children: [
      { label: "Executive Chairs", href: "/collections/executive-chairs" },
      { label: "Manager Chairs", href: "/collections/manager-chairs" },
      { label: "Visitor Chairs", href: "/collections/office-chairs-visitor-chairs" },
      { label: "Tablet Arm Chairs", href: "/collections/tablet-arm-chairs" },
      { label: "Cafeteria Chairs", href: "/collections/cafeteria-chairs" },
    ] },
    { label: "Workstations (by Design)", href: "/collections/workstations", children: [
      { label: "Ozone 2.0", href: "/collections/ozone-2-0" },
      { label: "Ariel 2.0", href: "/collections/ariel-2-0" },
      { label: "Ariel", href: "/collections/ariel" },
      { label: "Lunar", href: "/collections/lunar" },
      { label: "Triton", href: "/collections/triton" },
      { label: "Budget Pro", href: "/collections/budget-pro" },
      { label: "Orwell", href: "/collections/orwell" },
      { label: "Orbis", href: "/collections/orbis" },
    ] },
    { label: "Workstations (by Layout)", href: "/collections/workstations", badge: "STACK", children: [
      { label: "Linear", href: "/collections/workstations-by-layout" },
      { label: "Y (3 Persons)", href: "/collections/workstations-layout-y" },
      { label: "Grid (2 & 4 Persons)", href: "/collections/workstations-layout-grid" },
    ] },
    { label: "Executive Sets", href: "/collections/office-executive-furniture-sets", children: [
      { label: "Berlin", href: "/collections/berlin" },
      { label: "Antonin", href: "/collections/antonin" },
      { label: "Sidus", href: "/collections/sidus" },
      { label: "Traditional", href: "/collections/office-executive-furniture-sets-traditional" },
      { label: "Arc", href: "/collections/arc" },
      { label: "Arc 2.0", href: "/collections/arc-2-0" },
      { label: "Marcus", href: "/collections/marcus" },
      { label: "Conte", href: "/collections/conte" },
      { label: "Callisto", href: "/collections/callisto" },
      { label: "Nexis", href: "/collections/nexis-executive-set" },
      { label: "Omega", href: "/collections/omega" },
    ] },
    { label: "Seating", href: "/collections/seating", children: [
      { label: "Office Sofas", href: "/collections/office-sofas" },
    ] },
    { label: "Co-Working Spaces", href: "/collections/co-working-spaces", children: [
      { label: "Stools & Chairs", href: "/collections/co-working-spaces-stools-chairs" },
      { label: "Meeting Pods", href: "/collections/meeting-phone-pods" },
    ] },
    { label: "Storage", href: "/collections/office-storage", children: [
      { label: "Credenzas", href: "/collections/credenzas" },
      { label: "Drawer Pedestals", href: "/collections/drawer-pedestals" },
      { label: "Filing Cabinets", href: "/collections/filing-cabinets" },
      { label: "Coat Hangers", href: "/collections/coat-hanger" },
    ] },
  ] },
  { label: "Kitchens", href: "/collections/kitchens", children: [
    { label: "KITCHEN DESIGNS", href: "/collections/kitchen-designs", children: [
      { label: "View All Designs", href: "/collections/kitchens" },
    ] },
    { label: "KITCHEN ACCESSORIES", href: "/collections/kitchen-accessories", children: [
      { label: "Basket & Rack Systems", href: "/collections/basket-rack-system-2" },
    ] },
    { label: "KITCHEN APPLIANCES", href: "/collections/kitchen-appliances", children: [
      { label: "Kitchen Sinks", href: "/collections/kitchen-sink" },
      { label: "Microwave Ovens", href: "/collections/microwave-ovens" },
      { label: "View All Appliances", href: "/collections/kitchen-appliances" },
    ] },
  ] },
  { label: "Doors", href: "/collections/doors", children: [
    { label: "Main Doors", href: "/collections/main-doors" },
    { label: "Panel Doors", href: "/collections/panel-doors" },
    { label: "Glass Doors", href: "/collections/glass-door" },
    { label: "Veneer Doors", href: "/collections/veneer-door" },
    { label: "Thermoset Doors", href: "/collections/thermoset-doors" },
    { label: "Painted Doors", href: "/collections/painted-door" },
    { label: "Laminated Doors", href: "/collections/laminated-door" },
    { label: "Sliding Doors", href: "/collections/sliding-door" },
  ] },
  { label: "Wardrobes", href: "/collections/wardrobes-1", children: [
    { label: "", href: "" },
    { label: "Built-in Wardrobes", href: "/collections/built-in-wardrobes" },
    { label: "3 Door Free-Standing Wardrobes", href: "/collections/3-doors-wardrobes" },
    { label: "2 Door Free-Standing Wardrobes", href: "/collections/2-doors-wardrobes" },
    { label: "Sliding Free-Standing Wardrobes", href: "/collections/sliding-wardrobes" },
    { label: "Yale Safes", href: "/collections/yale-safes" },
  ] },
  { label: "Decor", href: "/collections/decor-acc", children: [
    { label: "All Decor Accessories", href: "/collections/decor-acc" },
    { label: "Cushions & Runners", href: "/collections/cushions" },
    { label: "Cushion Filling", href: "/collections/cushion-filling" },
    { label: "Clocks", href: "/collections/clocks" },
    { label: "Cork Mats", href: "/collections/cork-mats" },
  ] },
  { label: "Flooring", href: "/collections/laminate-flooring", children: [
    { label: "", href: "" },
    { label: "View All Designs", href: "/collections/laminate-flooring" },
  ] },
];

export const FOOTER_SEO_MENU: MenuSpec[] = [
  { label: "USEFUL FURNITURE CATEGORIES", href: "#", children: [
    { label: "Dressing Tables", href: "/collections/dressing-tables" },
    { label: "Bed Sets", href: "/collections/bed-set" },
    { label: "Double Bed Set", href: "/collections/double-bed-set" },
    { label: "Queen Size Beds", href: "/collections/queen-size-beds" },
    { label: "Bedsides", href: "/collections/bed-side-tables" },
    { label: "Bedroom Chairs", href: "/collections/bedroom-chairs" },
    { label: "CEO Chairs", href: "/collections/ceo-chairs" },
    { label: "Wall Mirrors", href: "/collections/wall-mirrors" },
    { label: "Sofas", href: "/collections/sofas" },
    { label: "Sofa Set", href: "/collections/sofa-set" },
    { label: "1 Seater Sofa", href: "/collections/sofas-all" },
    { label: "2 Seater Sofa", href: "/collections/2-seater-sofa" },
    { label: "3 Seater Sofa", href: "/collections/3-seater-sofa" },
    { label: "L Shaped Sofa", href: "/collections/l-shaped-sofa" },
    { label: "Ottomans", href: "/collections/ottoman" },
    { label: "Benches", href: "/collections/benches" },
    { label: "Recliners", href: "/collections/recliners" },
    { label: "Sofa Cum Bed", href: "/collections/sofa-cum-bed" },
    { label: "Kids Wardrobe", href: "/collections/kids-wardrobe" },
    { label: "Flooring", href: "/collections/flooring" },
    { label: "Stools", href: "/collections/stools" },
    { label: "Kids Furniture", href: "/collections/kids" },
    { label: "Bunk Beds", href: "/collections/bunk-beds" },
    { label: "Single Beds", href: "/collections/single-beds" },
    { label: "Vases & Bowls", href: "#" },
    { label: "Accent Tables", href: "#" },
    { label: "Lamps And Lighting", href: "/collections/lamps-and-lighting" },
    { label: "Paintings", href: "/collections/art-frames" },
    { label: "Study Chairs", href: "/collections/study-chairs" },
    { label: "Study Tables", href: "/collections/study-tables" },
    { label: "Flowers", href: "/collections/floral-pots" },
    { label: "Office Chair", href: "/collections/office-chairs" },
    { label: "Bar Stools", href: "/collections/bar-stools" },
    { label: "Dining Chairs", href: "/collections/dining-chairs" },
    { label: "Occassional Chairs", href: "/collections/accent-chairs" },
    { label: "Rocking Chairs", href: "/collections/relax-chairs" },
    { label: "Outdoor Furniture", href: "#" },
    { label: "Wall Clock", href: "/collections/clocks" },
    { label: "Bookshelves", href: "/collections/bookshelves" },
    { label: "Tables", href: "/collections/tables" },
    { label: "Dining Tables", href: "/collections/dining-tables" },
    { label: "Dining Table Set", href: "/collections/dining-table-sets" },
    { label: "Coffee Tables", href: "/collections/coffee-tables" },
    { label: "Nested Tables", href: "/collections/nested-tables" },
    { label: "Computer Tables", href: "/collections/computer-tables" },
    { label: "TV Units", href: "/collections/tv-units" },
  ] },
  { label: "SHOP FURNITURE BY ROOM", href: "#", children: [
    { label: "Living Room Furniture", href: "/collections/living" },
    { label: "Bedroom Furniture", href: "/collections/bedroom" },
    { label: "Dinning Furniture", href: "/collections/kitchen-dining-room-furniture-dining-chairs" },
    { label: "Study Furniture", href: "/collections/home-office-desks" },
    { label: "Office Furniture", href: "/collections/office" },
    { label: "Kids Furniture", href: "/collections/kids" },
  ] },
  { label: "OFFICE FURNITURE CATEGORIES", href: "#", children: [
    { label: "Office Tables", href: "/collections/office-tables" },
    { label: "Manager Tables", href: "/collections/manager-tables" },
    { label: "Executive Tables", href: "/collections/executive-tables" },
    { label: "Workstations", href: "/collections/workstations" },
    { label: "Reception Counters", href: "/collections/reception-counters" },
    { label: "Meeting Tables", href: "/collections/meeting-tables" },
    { label: "Office Chairs", href: "/collections/office-chairs" },
    { label: "CEO Chairs", href: "/collections/ceo-chairs" },
    { label: "High Back Chairs", href: "/collections/high-back-chairs" },
    { label: "Ergonomic Chairs", href: "/collections/ergonomic-study-chairs" },
    { label: "Cafe Chairs", href: "/collections/cafeteria-chairs" },
    { label: "Office Sofas", href: "/collections/office-sofas" },
    { label: "Office Sofa Set", href: "/collections/office-sofa-set" },
    { label: "Office Executive Furniture", href: "/collections/office-executive-furniture-sets" },
  ] },
  { label: "WARDROBES & KITCHEN DESIGNS", href: "#", children: [
    { label: "Kitchen Design", href: "/collections/kitchen-designs" },
    { label: "Kitchen Cabinets", href: "/collections/kitchens" },
    { label: "Small Kitchen Design", href: "/collections/kitchens?page=1" },
    { label: "Kitchen Accessories", href: "/collections/kitchen-accessories" },
    { label: "Kitchen Sink", href: "/collections/kitchen-sink" },
    { label: "Kitchen Hood", href: "#" },
    { label: "Wardrobe Design", href: "/collections/wardrobes-1?page=1" },
    { label: "Built-in wardrobes", href: "/collections/built-in-wardrobes" },
    { label: "Sliding Wardrobes", href: "/collections/sliding-wardrobes" },
  ] },
];

export const FOOTER_INFORMATION: MenuSpec[] = [
  { label: 'About Us', href: '/pages/about-us' },
  { label: 'Store Locator', href: '/pages/store-locator' },
  { label: 'Product Catalogues', href: '/pages/catalogues' },
  { label: 'Blog', href: '/blogs/news' },
  { label: 'Payments', href: '/pages/payment' },
  { label: 'Shipping', href: '/pages/shipping-and-delivery' },
  { label: 'Authorized Dealers', href: '/pages/authorized' },
  { label: 'Careers', href: '/pages/contact' },
  { label: 'Terms of Offers for Sale', href: '/pages/terms-of-offers-for-sale' },
  { label: 'Terms of Use', href: '/pages/terms-of-use' },
  { label: 'Privacy Policy', href: '/pages/privacy-policy' },
];

export const FOOTER_USER_AREA: MenuSpec[] = [
  { label: 'Corporate', href: '/pages/contact' },
  { label: 'Corporate Form', href: '/pages/contact' },
  { label: 'Contact Us', href: '/pages/contact' },
  { label: 'Information/Lead Form', href: '/pages/lead-form' },
  { label: 'Rewards', href: '/pages/rewards' },
  { label: 'Loyalty Form', href: '/pages/loyalty-form' },
  { label: 'Customer service', href: '/pages/support-complaint-form' },
  { label: 'Track my ticket', href: '/pages/track-your-ticket' },
];

/** Announcement bar (live copy verbatim). */
export const GLOBAL_SETTINGS: Record<string, string> = {
  announcement: 'Save more this wedding season!',
  announcementHref: '/pages/wedding-package-builder',
  announcementCta: 'Shop Now!',
  announcementCtaHref: '/collections/sale',
};

/** Menu locations the live chrome does not render. */
export const OBSOLETE_MENU_LOCATIONS = ['FOOTER_3', 'TOPBAR'];

export const GLOBAL_MENUS: Record<string, MenuSpec[]> = {
  MAIN: MAIN_MENU,
  FOOTER_1: FOOTER_INFORMATION,
  FOOTER_2: FOOTER_USER_AREA,
  FOOTER_SEO: FOOTER_SEO_MENU,
};

export async function createMenuTree(prisma: PrismaClient, items: MenuSpec[], location: string, parentId: number | null = null) {
  let position = 0;
  for (const it of items) {
    const created = await prisma.menuItem.create({
      data: { label: it.label, href: it.href, location, parentId, position: position++, badge: it.badge ?? null },
    });
    if (it.children?.length) await createMenuTree(prisma, it.children, location, created.id);
  }
}

export async function applyGlobalFidelity(prisma: PrismaClient) {
  for (const [location, items] of Object.entries(GLOBAL_MENUS)) {
    await prisma.menuItem.deleteMany({ where: { location } });
    await createMenuTree(prisma, items, location);
  }
  await prisma.menuItem.deleteMany({ where: { location: { in: OBSOLETE_MENU_LOCATIONS } } });
  for (const [key, value] of Object.entries(GLOBAL_SETTINGS)) {
    await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
}

// standalone run (not when imported by prisma/seed.ts)
if (process.argv[1] && /fidelity[\\/]global\.ts$/.test(process.argv[1])) {
  const prisma = new PrismaClient();
  applyGlobalFidelity(prisma)
    .then(async () => {
      const counts = await prisma.menuItem.groupBy({ by: ['location'], _count: true });
      console.log('global fidelity applied:', counts.map((c) => `${c.location}=${c._count}`).join(' '));
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
