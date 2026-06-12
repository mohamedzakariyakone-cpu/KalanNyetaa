export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 p-6">
      <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-10 shadow-lg">
        <h1 className="text-3xl font-black mb-4">Hors connexion</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          L'application est actuellement hors-ligne. Certaines fonctionnalités ne sont peut-être pas disponibles, mais vous pouvez continuer à travailler localement. Les modifications seront synchronisées dès le retour du réseau.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="/"
            className="rounded-2xl bg-slate-900 px-5 py-3 text-white font-bold text-center hover:bg-slate-800 transition"
          >
            Retour à l'accueil
          </a>
          <a
            href="/offline"
            className="rounded-2xl border border-slate-200 px-5 py-3 text-slate-700 font-bold text-center hover:bg-slate-50 transition"
          >
            Recharger
          </a>
        </div>
      </div>
    </main>
  )
}
