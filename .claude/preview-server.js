const path = require("path");
const express = require("express");
const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));
app.listen(3101, "127.0.0.1", () => console.log("Static preview on 3101"));
