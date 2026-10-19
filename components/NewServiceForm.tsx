"use client";

import { useActionState } from "react";
import { createServiceAction, type FormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initial: FormState = {};

export function NewServiceForm() {
  const [state, formAction, pending] = useActionState(
    createServiceAction,
    initial,
  );

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Service name</FieldLabel>
          <Input id="name" name="name" required placeholder="My Web App" />
        </Field>

        <Field data-invalid={state.error?.includes("Slug") ? true : undefined}>
          <FieldLabel htmlFor="slug">Slug</FieldLabel>
          <Input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9-]*"
            placeholder="my-web-app"
            aria-invalid={state.error?.includes("Slug") ? true : undefined}
          />
          <FieldDescription>
            Lowercase letters, digits and dashes. Used in admin URLs.
          </FieldDescription>
        </Field>

        {state.error ? (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create service"}
        </Button>
      </FieldGroup>
    </form>
  );
}
