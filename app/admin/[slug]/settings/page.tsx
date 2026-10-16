import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceBySlug } from "@/lib/queries";
import { getDb } from "@/db/client";
import { SettingsForm } from "@/components/SettingsForm";
import { CopySnippet } from "@/components/CopySnippet";
import { regenerateEmbedKeyAction } from "@/app/admin/actions";

export default async function ServiceSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getServiceBySlug(getDb(), slug);
  if (!service) {
    notFound();
  }

  const embedBaseUrl = process.env.ADMIN_BASE_URL ?? "http://localhost:3000";
  const snippet = `<iframe src="${embedBaseUrl}/embed?k=${service.embedKey}" style="width:100%;max-width:480px;height:460px;border:0;border-radius:12px" title="Feedback"></iframe>`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold">{service.name} — Settings</h1>
        <Link href={`/admin/${service.slug}`} className="text-sm text-neutral-500 underline">
          ← Back to inbox
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          General
        </h2>
        <SettingsForm
          serviceId={service.id}
          slug={service.slug}
          name={service.name}
          webhookUrl={service.webhookUrl}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Embed snippet
        </h2>
        <p className="mb-2 max-w-xl text-sm text-neutral-500">
          Paste this into any page of {service.name} to collect feedback.
        </p>
        <CopySnippet text={snippet} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Danger zone
        </h2>
        <form action={regenerateEmbedKeyAction}>
          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="slug" value={service.slug} />
          <p className="mb-2 max-w-xl text-sm text-neutral-500">
            Regenerating the embed key invalidates every snippet currently deployed for this service.
          </p>
          <button
            type="submit"
            className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Regenerate embed key
          </button>
        </form>
      </section>
    </div>
  );
}
