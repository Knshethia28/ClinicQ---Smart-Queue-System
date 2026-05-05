const lat = 19.2183;
const lng = 73.0867;
const url = `http://localhost:5001/api/clinics/nearby?lat=${lat}&lng=${lng}`;
const run = async () => {
  const res = await fetch(url);
  const data = await res.json();
  console.log('meta:', data.meta);
  const rows = (data.clinics || []).slice(0, 20).map((c) => ({
    name: c.name,
    distanceKm: c.distanceKm,
    source: c.source,
    address: c.address,
  }));
  console.log(JSON.stringify(rows, null, 2));
};
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
