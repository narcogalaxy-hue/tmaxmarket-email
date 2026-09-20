const { createApp } = require("./app");

const PORT = process.env.PORT || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`TmaxMarket.it email server running on port ${PORT}`);
});
