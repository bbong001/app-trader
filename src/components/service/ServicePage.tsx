import ServiceHeader from './ServiceHeader';
import ConversationBanner from './ConversationBanner';
import ChatWindow from './ChatWindow';

export default function ServicePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-200">
      <ServiceHeader />

      <div className="flex-1 flex flex-col">
        <ConversationBanner />

        {/* Chat area */}
        <div className="flex-1 flex flex-col mt-2">
          <ChatWindow />
        </div>
      </div>
    </div>
  );
}


