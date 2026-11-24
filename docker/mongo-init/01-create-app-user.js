const appDatabase = process.env.MONGO_APP_DATABASE || "clean_code_todos";
const appUsername = process.env.MONGO_APP_USERNAME || "todo_api";
const appPassword = process.env.MONGO_APP_PASSWORD;

if (!appPassword) {
  throw new Error("MONGO_APP_PASSWORD must be set before MongoDB initializes.");
}

db.getSiblingDB(appDatabase).createUser({
  user: appUsername,
  pwd: appPassword,
  roles: [{ role: "readWrite", db: appDatabase }],
});
