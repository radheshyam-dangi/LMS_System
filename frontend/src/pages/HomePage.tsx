type HomePageProps = {
  onLoginClick: () => void;
};

export function HomePage({ onLoginClick }: HomePageProps) {
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-copy">
          <p className="eyebrow">SkillForge</p>
          <h1>Engineering learning management for role-based training teams.</h1>
          <p>
            SkillForge helps administrators invite users, assign roles, and give every learner,
            trainer, and admin a focused workspace for assignments, progress, reviews, and growth.
          </p>
          <button className="primary-button" type="button" onClick={onLoginClick}>
            Login
          </button>
        </div>
      </section>
    </main>
  );
}
