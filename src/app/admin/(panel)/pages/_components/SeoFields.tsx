import { Field, SectionCard, TextArea, TextInput } from '@/components/admin/ui';

/** "Search engine listing" card shared by pages and blog posts (SPEC §5.3.2). */
export function SeoFields({ seoTitle, seoDescription, idPrefix }: { seoTitle: string; seoDescription: string; idPrefix: string }) {
  return (
    <SectionCard title="Search engine listing" description="How this appears in Google results.">
      <div className="space-y-4">
        <Field
          label="SEO title"
          htmlFor={`${idPrefix}-seo-title`}
          hint="Shown in Google results and the browser tab. Leave empty to use the page title."
        >
          <TextInput id={`${idPrefix}-seo-title`} name="seoTitle" defaultValue={seoTitle} maxLength={60} showCount />
        </Field>
        <Field label="SEO description" htmlFor={`${idPrefix}-seo-description`} hint="The short text under the title in Google results.">
          <TextArea id={`${idPrefix}-seo-description`} name="seoDescription" rows={3} defaultValue={seoDescription} maxLength={160} showCount />
        </Field>
      </div>
    </SectionCard>
  );
}
