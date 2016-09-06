import {Store, initStateLeaves, genStateTree} from "./../src/index.js";
import {expect} from "chai";

describe("genStateTree", () => {
	it("generates state tree based upon action tree", () => {
		let actions = {
			feed: {
				list: {
					fetch() {}
				},
				order: {
					latest() {},
					popular() {}
				}
			},
			chats: {
				userX: {
					sendMessage () {},
					receiveMessage() {}
				}
			}
		};

		let expectedStateTree = {
			feed: {
				list: undefined,
				order: undefined
			},
			chats: {
				userX: undefined
			}
		};

		expect(genStateTree(actions)).to.eql(expectedStateTree);
		expect(genStateTree(actions)).to.not.equal(expectedStateTree);
	});

	it("sets initial states", () => {
		let actions = {
			feed: {
				list: {
					init() {return []},
					fetch() {}
				},
				order: {
					init() {return "latest"},
					latest() {},
					popular() {}
				}
			},
			chats: {
				userX: {
					sendMessage () {},
					receiveMessage() {}
				}
			}
		};

		let expectedStateTree = {
			feed: {
				list: [],
				order: "latest"
			},
			chats: {
				userX: undefined
			}
		};

		expect(genStateTree(actions)).to.eql(expectedStateTree);
		expect(genStateTree(actions)).to.not.equal(expectedStateTree);
	});
});

describe("Store", () => {
	let actions;

	beforeEach(() => {
		actions = {
			todos: {
				add () {}
			}
		};
	});

	it("accepts actions.", () => {
		let astore = Store(actions);
		expect(astore.actions()).to.equal(actions);
	});

	it("complains if actions is absent.", () => {
		expect(Store.bind(Store)).to.throw(Error);
	});

	it("accepts initial middlewares", () => {
		let initialMiddlewares = {};
		let astore = Store(actions, initialMiddlewares);
		expect(astore.middlewares()).to.equal(initialMiddlewares);
	});

	it("accepts initial state", () => {
		let initialState = {todos: {}};
		let astore = Store(actions, {}, initialState);
		expect(astore()).to.eql(initialState);
	});

	it("'s instance is a getter/setter of state.", () => {
		let astore = Store(actions);

		let data = {todos: [1]};
		astore(data);

		expect(astore()).to.eql(data);
	})

	it("has 'actions' method.", () => {
		let astore = Store(actions);
		expect(astore.actions).to.exist;
	});

	it("has 'middlewares' method.", () => {
		let astore = Store(actions);
		expect(astore.middlewares).to.exist;
	});

	it("has 'dispatch' method.", () => {
		let astore = Store(actions);
		expect(astore.dispatch).to.exist;
	});


	it("has 'attach' method.", () => {
		let astore = Store(actions);
		expect(astore.attach).to.exist;
	});

	describe("actions", () => {
		it("gets actions.", () => {
			let todosAction = {
				add () {}
			};

			let astore = Store({todos: todosAction});
			expect(astore.actions().todos).to.equal(todosAction);
		});
	});

	describe("dispatch", () => {
		let astore;

		beforeEach(() => {
			let todosActions = {
				add (todos = [], atodo) {
					return todos.concat(atodo);
				}
			};
			astore = Store({todos: todosActions});
		});

		it("applies action at specified path to state associated with it.", () => {
			astore.dispatch("todos.add", "Go to mars.")
			expect(astore().todos).to.eql(["Go to mars."]);
		});

		it("passes 'path', 'action', and 'store' to the middleware.", () => {
			let dpath, daction, dstore;
			let mid = (path, action, store) => {
				return (previousState, payload) => {
					dpath = path;
					daction = action;
					dstore = store;
					return action(previousState, payload);
				};
			};

			astore.attach(mid);
			astore.dispatch("todos.add");

			expect(dpath).to.equal("todos.add");
			expect(daction).to.exist;
			expect(dstore).to.equal(astore);

		});

		it("applies midlewares", () => {
			let mid1BeforeLog;
			let mid1AfterLog;
			let mid1 = (path, action) => {
				return (previousState, payload) => {
					mid1BeforeLog = [Object.assign({}, previousState), payload, path];

					let newState = action(previousState, payload);

					mid1AfterLog = newState;

					return newState;
				};
			};

			let mid2BeforeLog;
			let mid2AfterLog;
			let mid2 = (path, action) => {
				return (previousState, payload) => {
					mid2BeforeLog = [Object.assign({}, previousState), payload, path];

					let newState = action(previousState, payload);

					mid2AfterLog = newState;

					return newState;
				};
			};

			astore.attach("", mid1);
			astore.attach("", mid2);
			astore.dispatch("todos.add", "Pass this test.");

			let expectedPreviousState = {
				todos: undefined
			};

			expect(mid1BeforeLog).to.eql(
					[expectedPreviousState, "Pass this test.", "todos.add"]);
			expect(mid1AfterLog).to.eql({todos: ["Pass this test."]});

			expect(mid2BeforeLog).to.eql(
					[expectedPreviousState, "Pass this test.", "todos.add"]);
			expect(mid2AfterLog).to.eql({todos: ["Pass this test."]});
		});

		it("throws on invalid action path", () => {
			expect(astore.dispatch.bind(astore, "invalid.path")).to.throw(Error);
		});

		it("can dispatch to nested actions", () => {
			let actionTree = {
				todos: {
					list: {
						add (previousState = [], payload) {
							return previousState.concat(payload);
						}
					},
					checkAll: {
						toggle (previousState = false) {
							return !previousState;
						}
					}
				}
			};

			let store = Store(actionTree);
			let before = store();

			store.dispatch("todos.list.add", "Test nested dispatch.");
			store.dispatch("todos.checkAll.toggle");

			let after = store();

			// make sure state reference is maintained
			expect(before).to.equal(after);
			expect(before.todos).to.equal(after.todos);
			expect(before.todos.list).to.eql(["Test nested dispatch."]);;

			expect(after.todos.checkAll).to.equal(true);


		});
	});

	describe("attach", () => {
		let astore;

		beforeEach(() => {
			let actions = {
				todos: {
					add () {}
				}
			};
			astore = Store(actions);
		});

		it("attaches middleware", () => {
			let mid1 = astore.attach(()=>{});
			expect(astore.middlewares()).to.eql([mid1]);
		});


		it("returns a middleware which acts on specific path.", () => {
			let middlewareLog;
			let middleware = (path, action) => {
				return (previousState, payload) => {
					middlewareLog = [path, previousState, payload];
					return action(previousState, payload);
				};
			};
			let action = (previousState, payload) => {
				return [previousState, payload];
			};

			let returnVal;
			// "" - global
			let globalMiddleware = astore.attach(middleware);
			expect(globalMiddleware).to.exist;

			returnVal = globalMiddleware("todos", action)("previousState", "payload");
			expect(middlewareLog).to.eql(["todos", "previousState", "payload"]);
			expect(returnVal).to.eql(["previousState", "payload"]);

			// "key"
			let todoMiddleware = astore.attach("todos", middleware);
			expect(todoMiddleware).to.exist;

			returnVal = todoMiddleware("todos.remove", action)("previousState", "payload");
			expect(middlewareLog).to.eql(["todos.remove", "previousState", "payload"]);
			expect(returnVal).to.eql(["previousState", "payload"]);

			middlewareLog = [];
			returnVal = todoMiddleware("todos.add", action)("previousState", "payload");
			expect(middlewareLog).to.eql(["todos.add", "previousState", "payload"]);
			expect(returnVal).to.eql(["previousState", "payload"]);

			// "key.action"
			let todosAddMiddleware = astore.attach("todos.add", middleware);
			expect(todoMiddleware).to.exist;

			returnVal = todosAddMiddleware("todos.add", action)("previousState", "payload");
			expect(middlewareLog).to.eql(["todos.add", "previousState", "payload"]);
			expect(returnVal).to.eql(["previousState", "payload"]);
		});

		it("can be detached from middleware pool.", () => {
			let mid1 = astore.attach(()=>{});
			mid1.detach();
			expect(astore.middlewares()).to.eql([]);
		});
	});


	describe("middlewares", () => {
		it("lists midlewares attached to a store.", () => {
			let actions = {
				todos: {
					add () {}
				}
			};
			let astore = Store(actions);
			let mid1 = astore.attach(()=>{});
			expect(astore.middlewares()).to.eql([mid1]);
		});
	});
});
