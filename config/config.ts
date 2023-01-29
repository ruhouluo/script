import { config } from "dotenv";

const env = config({ path: ".env"});

export default env.parsed;
