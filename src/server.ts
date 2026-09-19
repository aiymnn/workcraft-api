import app from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`Workcraft API running on port ${env.PORT}`);
  console.log(
    `Swagger UI running on http://localhost:${env.PORT}/api-docs`,
  );
});
