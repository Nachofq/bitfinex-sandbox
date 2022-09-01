import "mocha";
import assert from "assert";
import axios from "axios";
import settings from "../src/settings";

class SimpleTest {
  online() {
    return { status: "ok" };
  }
}

let simpleTest: SimpleTest;

beforeEach(() => {
  simpleTest = new SimpleTest();
});

describe("Online API Test", () => {
  it("is it online?", async () => {
    const response = await axios.get(`http://localhost:${settings.PORT}`);
    assert.deepStrictEqual(simpleTest.online(), response.data);
  });
});
