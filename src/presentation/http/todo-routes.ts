import { Router } from "express";
import type { TodoController } from "./todo-controller.js";

export function createTodoRoutes(controller: TodoController): Router {
  const router = Router();

  router.post("/", controller.create);
  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.patch("/:id", controller.update);
  router.delete("/:id", controller.delete);

  return router;
}
