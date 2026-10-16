import { NewServiceForm } from "@/components/NewServiceForm";

export const metadata = {
  title: "New service — Feedback Admin",
};

export default function NewServicePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">New service</h1>
      <NewServiceForm />
    </div>
  );
}
