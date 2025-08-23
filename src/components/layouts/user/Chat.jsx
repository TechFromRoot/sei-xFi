import { Send } from 'lucide-react';
import React, { useState } from 'react';

const Chat = () => {
  const [inputValue, setInputValue] = useState('');

  const tradingOptions = [
    "Tip 0.01 sei to ekete.eth",
    // "Buy me $20 of $BNKR if the price dips 10%",
    "Send $5 to @xDeployer on X",
    "Sell all of my coins where my total balance is worth less than $5",
    "Deploy a coin on Sei",
  ];

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-logo">🤖</div>
        <div className="chat-title">gm, how can I help you?</div>
      </div>

      {/* Chat Options */}
      <div className="chat-options">
        {tradingOptions.map((option, index) => (
          <div key={index} className="chat-option">
            <span className="chat-option-arrow">&gt;</span>
            <span className="chat-option-text">{option}</span>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="chat-input-area">
        <div className="chat-input-box">
          <span className="chat-prefix">//</span>
          <input
            type="text"
            placeholder="what's up?"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="chat-input"
          />
          <button className="chat-send-btn">
            <Send className='icon'/>
          </button>
        </div>
      </div>
     
    </div>
  );
};

export default Chat;
