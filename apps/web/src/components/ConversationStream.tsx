import { MessageSquareText } from "lucide-react";

export type ConversationMessage = {
  id: string;
  author: string;
  time: string;
  body: string;
};

const defaultMessages: ConversationMessage[] = [
  {
    id: "task-9",
    author: "Command Brain",
    time: "09:12",
    body: "Task 9 picked up. Keep changes inside apps/web and preserve the shared API contract.",
  },
  {
    id: "shell",
    author: "Frontend Pair",
    time: "09:18",
    body: "Render test is driving the shell. Static panels will surface roster, requirements, chat, and gates.",
  },
  {
    id: "qa",
    author: "QA Sentinel",
    time: "09:22",
    body: "Need test, typecheck, and build evidence before release approval.",
  },
];

type ConversationStreamProps = {
  messages?: ConversationMessage[];
};

export function ConversationStream({ messages = defaultMessages }: ConversationStreamProps) {
  return (
    <section className="panel conversationPanel" aria-labelledby="conversation-heading">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Workspace log</p>
          <h2 id="conversation-heading">Conversation</h2>
        </div>
        <MessageSquareText aria-hidden="true" />
      </div>
      <ol className="conversationList">
        {messages.map((message) => (
          <li className="messageRow" key={message.id}>
            <div className="rowSplit">
              <strong>{message.author}</strong>
              <time>{message.time}</time>
            </div>
            <p>{message.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
