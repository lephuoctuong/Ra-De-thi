import app from "./server";

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(`🚀 Ra-De-thi API running at http://localhost:${PORT}`);
});