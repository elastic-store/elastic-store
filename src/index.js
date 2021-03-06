export const isEmpty = (obj) => {
	return JSON.stringify(obj) === JSON.stringify({});
};

export const genStateTree = (tree, state = {}) => {
	for (let key in tree) {
		if (tree.hasOwnProperty(key)) {
			if (typeof tree[key] === "function") {
				state = tree.init? tree.init(): undefined;
			}
			else {
				state[key] = state[key] || {}
				state[key] = genStateTree(tree[key], state[key]);
			}
		}
	}
	return state;
};


export const Store = function (actions = {}, middlewares = [], initialState = {}) {
	let state = genStateTree(actions);
	Object.assign(state, initialState);

	let newStore = function (stateOverrides) {
		if (stateOverrides) {
			Object.assign(state, stateOverrides);
		}

		return state;	
	};

	newStore.actions = function (newActions) {
		if (newActions) {
			actions = Object.assign(actions, newActions);
			genStateTree(newActions, state);
		}
		return actions;
	};

	newStore.dispatch = function (path, payload) {
		let wrappedAction = (entireState, payload) => {
			let frags = path.split(".");
			let action;

			try {
				action = frags.reduce((path, frag) => {
					let subPath = path[frag];

					if (subPath) {
						return subPath;
					}

					throw new TypeError();
				}, actions);

				if (typeof action !== "function") {
					throw new TypeError();
				}
			}
			catch (err) {
				if (err instanceof TypeError) {
					throw Error(`Could not find action associated with path '${path}'.`);
				}
			}

			let setValueAtPath = (subTree, frags) => {
				let frag = frags.shift();

				if (frags.length > 0) {
					subTree[frag] = setValueAtPath(subTree[frag], frags);
					return subTree;
				}

				subTree[frag] = action(subTree[frag], payload);
				return subTree;
			};

			frags.pop();

			return setValueAtPath(entireState, frags);
		};

		let finalAction = middlewares.reduceRight((next, middleware) => {
			return middleware(path, next, newStore);
		}, wrappedAction);

		return finalAction(state, payload)
	};

	newStore.attach = (desiredPath, middleware) => {
		let pathAwareMiddleware = (appliedPath, next, store) => {
			if (typeof desiredPath === "function") {
				return desiredPath(appliedPath, next, store);
			}

			if (!Array.isArray(desiredPath)) {
				desiredPath = [desiredPath];
			}

			for (let i = 0; i < desiredPath.length; i ++) {
				if (appliedPath.indexOf(desiredPath[i]) === 0) {
					return middleware(appliedPath, next, store);
				}
			}

			return next;
		};

		pathAwareMiddleware.detach = () => {
			let index = middlewares.indexOf(pathAwareMiddleware);
			if (index !== -1) {
				middlewares.splice(index, 1);
			}
		};

		middlewares.push(pathAwareMiddleware);

		return pathAwareMiddleware;
	};

	newStore.middlewares = () => {
		return middlewares;
	};

	return newStore;
};
