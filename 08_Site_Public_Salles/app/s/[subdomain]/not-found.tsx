export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">Salle introuvable</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-400">
          Cette adresse ne correspond à aucune salle active. Vérifiez le lien ou contactez directement votre salle.
        </p>
      </div>
    </div>
  );
}
