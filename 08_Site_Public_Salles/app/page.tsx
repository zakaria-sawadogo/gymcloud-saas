export default function RootPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink-900">GymCloud</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-400">
          Cette adresse héberge les sites publics des salles GymCloud — accédez au vôtre via son sous-domaine dédié
          (ex : fitnessclub.gymcloud.africa).
        </p>
      </div>
    </div>
  );
}
