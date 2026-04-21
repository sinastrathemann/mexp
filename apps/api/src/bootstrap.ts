try {
  process.loadEnvFile("../../.env");
} catch {
  // .env ist in Produktion/Containern nicht nötig — echte Env-Vars
}
