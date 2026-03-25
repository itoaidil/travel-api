function SectionCard({ title, subtitle, children }) {
  return (
    <section className="section-card">
      <header className="section-header">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <div className="section-content">{children}</div>
    </section>
  );
}

export default SectionCard;
