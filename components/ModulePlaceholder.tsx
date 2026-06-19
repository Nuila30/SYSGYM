import DashboardMenu from "@/components/DashboardMenu";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  fullName: string;
  username: string;
  role: string;
  children?: React.ReactNode;
};

export default function ModulePlaceholder({
  title,
  description,
  fullName,
  username,
  role,
  children,
}: ModulePlaceholderProps) {
  return (
    <main className="min-h-screen bg-neutral-100 lg:flex">
      <DashboardMenu fullName={fullName} username={username} role={role} />

      <section className="flex-1">
        <header className="border-b bg-white">
          <div className="mx-auto max-w-7xl px-6 py-5">
            <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>

            <p className="mt-1 text-sm text-neutral-500">{description}</p>
          </div>
        </header>

        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            {children || (
              <>
                <h2 className="text-xl font-bold text-neutral-900">
                  Módulo en preparación
                </h2>

                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Esta sección ya está creada. El siguiente paso será agregar
                  formularios, tablas y conexión con la base de datos.
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}