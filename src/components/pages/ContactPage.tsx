import { getSettingsMap } from '@/lib/queries';
import { ContactForm } from './ContactForm';

/** The store's contact details, as set in Admin → Settings → Contact details ('' = not set). */
export type ContactDetails = { phone: string; email: string; address: string };

export async function getContactDetails(): Promise<ContactDetails> {
  const settings = await getSettingsMap();
  return {
    phone: settings.phone?.trim() ?? '',
    // the customer care address; the complaints address when only that one is set
    email: (settings.email?.trim() || settings.complaintsEmail?.trim()) ?? '',
    address: settings.address?.trim() ?? '',
  };
}

type Block = { label: string; value: React.ReactNode };

/**
 * The built-in Contact us page (/pages/contact): "Contact Us" with the form (8 cols; it lands in Admin → Messages)
 * + the phone, email and address from Settings (4 cols); anything not set in Settings is left out. No map: the old
 * shop's pin was hard-coded, and a pin guessed from a typed address can send customers to the wrong street.
 */
export async function ContactPage({ details }: { details?: ContactDetails } = {}) {
  const { phone, email, address } = details ?? (await getContactDetails());
  const blocks = [
    email && {
      label: 'Email',
      value: (
        <a href={`mailto:${email}`} className="underline underline-offset-[3px]">
          {email}
        </a>
      ),
    },
    phone && {
      label: 'Contact',
      value: (
        <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="underline underline-offset-[3px]">
          {phone}
        </a>
      ),
    },
    address && {
      label: 'Location',
      value: address
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .flatMap((line, i) => (i ? [<br key={`br-${i}`} />, line] : [line])),
    },
  ].filter(Boolean) as Block[];

  return (
    <>
      <div className="section-spacing">
        <div className="container-iw">
          <h1 className="h3 mb-[25px] md:mb-10">Contact Us</h1>
        </div>
        <div className="mx-auto flex max-w-[1360px] flex-wrap px-[5px] md:px-[25px]">
          <div className={`w-full px-[7.5px] md:px-[15px] ${blocks.length ? 'md:w-2/3' : ''}`}>
            <ContactForm />
          </div>
          {blocks.length > 0 && (
            // on a phone the details sit under the form: keep them clear of the SEND MESSAGE button
            <div className="mt-[35px] w-full px-[7.5px] md:mt-0 md:w-1/3 md:px-[15px]">
              {blocks.map((block) => (
                <div key={block.label} className="mb-[35px]">
                  <strong className="mb-[10px] block font-medium leading-none">{block.label}</strong>
                  <div className="rte">
                    <p className="!text-[15px] !leading-[1.7]">{block.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
