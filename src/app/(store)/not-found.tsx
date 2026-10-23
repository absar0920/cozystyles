import Link from 'next/link';
import '@/components/pages/content.css';

/**
 * The shop's "Page not found" (live template-404: centred 470px block, heading, one paragraph, accent2 button),
 * inside the store header and footer. Unknown addresses reach it through `[...slug]/page.tsx`.
 */
export default function NotFound() {
  return (
    <div className="sf-page container-iw">
      <div className="mx-auto max-w-[470px] py-10 text-center md:py-[70px] lg:py-[100px]">
        <h1 className="mb-5">Page not found</h1>
        <p className="mb-5 leading-[1.7]">
          The page you were looking for doesn’t exist. You may have mistyped the address or the page may have moved.
        </p>
        <Link href="/" className="btn btn-accent2 mt-5 border-0">
          <span className="leading-[1.75]">Continue shopping</span>
        </Link>
      </div>
    </div>
  );
}
