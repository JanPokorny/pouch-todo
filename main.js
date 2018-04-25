const { h, app } = window.hyperapp;

const TodoItem = ({ doc, toggleDone }) =>
  h(
    "label",
    {
      key: doc._id,
      class: doc.done && "done"
    },
    [
      h("input", {
        type: "checkbox",
        checked: doc.done,
        onchange: () => toggleDone(doc)
      }),
      " ",
      doc.text
    ]
  );

const memoryDB = new PouchDB("local-todos", { adapter: "memory" });
const localDB = new PouchDB("local-todos", { adapter: "idb" });
const remoteDB = new PouchDB("https://couchdb-dafadc.smileupps.com/todos");

const localSync = memoryDB
  .sync(localDB, {
    live: true,
    retry: true
  })
  .on("change", function(change) {
    console.log("LOCAL: A db change occurred " + JSON.stringify(change));
  })
  .on("paused", function() {
    console.log("LOCAL: Replication paused");
  })
  .on("active", function(info) {
    console.log("LOCAL: Replication resumed " + info);
  })
  .on("error", function(err) {
    console.log("vLOCAL: Sync Error occurred " + err);
  });

const remoteSync = memoryDB
  .sync(remoteDB, {
    live: true,
    retry: true
  })
  .on("change", function(change) {
    console.log("REMOTE: A db change occurred " + JSON.stringify(change));
  })
  .on("paused", function() {
    console.log("REMOTE: Replication paused");
  })
  .on("active", function(info) {
    console.log("REMOTE: Replication resumed " + info);
  })
  .on("error", function(err) {
    console.log("vREMOTE: Sync Error occurred " + err);
  });

const db = memoryDB;

const state = {
  todos: [],
  newTodoText: ""
};

const actions = {
  fetchTodos: () => async (state, actions) =>
    actions.updateTodos(
      (await db.query(doc => emit(doc.text.toLowerCase()), {
        include_docs: true
      })).rows.map(r => r.doc)
    ),
  updateTodos: todos => ({ todos }),
  setNewTodoText: newTodoText => ({ newTodoText }),
  addNewTodo: () => state => {
    db.post({ text: state.newTodoText, done: false });
    return { newTodoText: "" };
  },
  toggleDone: doc => state => db.put({ ...doc, done: !doc.done }),
  removeDone: () => state =>
    db.bulkDocs(
      state.todos
        .filter(todo => todo.done)
        .map(todo => ({ ...todo, _deleted: true }))
    )
};

const view = (state, actions) =>
  h("div", {}, [
    h(
      "div",
      {},
      state.todos.map(doc => TodoItem({ doc, toggleDone: actions.toggleDone }))
    ),
    h("div", {}, [
      h("input", {
        type: "text",
        value: state.newTodoText,
        oninput: e => actions.setNewTodoText(e.target.value)
      }),
      h(
        "button",
        {
          onclick: e => actions.addNewTodo()
        },
        "Add todo"
      ),
      " ",
      h(
        "button",
        {
          class: "button-outline",
          onclick: e => actions.removeDone()
        },
        "Remove done"
      )
    ])
  ]);

const main = app(state, actions, view, document.querySelector("#app"));
main.fetchTodos();
db
  .changes({
    live: true,
    since: "now"
  })
  .on("change", main.fetchTodos);
