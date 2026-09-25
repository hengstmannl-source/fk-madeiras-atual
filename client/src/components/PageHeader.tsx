import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type PageHeaderProps = {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function PageHeader({ icon: Icon, eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <section className="fk-page-header">
      <div className="flex min-w-0 items-start gap-3">
        <div className="fk-page-header__icon"><Icon aria-hidden="true" className="h-5 w-5" /></div>
        <div className="min-w-0">
          {eyebrow ? <p className="fk-eyebrow">{eyebrow}</p> : null}
          <h1 className="fk-page-header__title">{title}</h1>
          <p className="fk-page-header__description">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
