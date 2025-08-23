import React from "react";
import "../../assets/css/userDashboard.css";
import Usernav from "../layouts/user/Usernav";
import dp from "../../assets/images/dp.jpg";
import dp2 from "../../assets/images/dp2.png";
import { ExternalLink } from "lucide-react";
import Chat from "../layouts/user/Chat";
import WalletSec from "../layouts/user/WalletSec";

function Dasboard() {
  const tips = Array.from({ length: 20 }, (_, i) => i + 1);

  return (
    <div className="userDashboard">
      <Usernav />
      <main>
        <div className="transactions">
          <h1>Transactions</h1>
          <div className="rows">
            <a
              href={`https://seitrace.com/tx/dsdhisd`}
              target="_blank"
              rel="noopener noreferrer"
              className="messageBox"
            >
              <img src={dp} alt="" className="dp" />
              <h2> ekete.eth Tiped you 0.01</h2>
              <h3>1 min ago</h3>
            </a>
            {tips.map((i) => (
              <a
                key={i}
                href={`https://seitrace.com/tx/dummyHash${i}`}
                target="_blank"
                rel="noopener noreferrer"
                className="messageBox"
              >
                <img src={dp} alt="" className="dp" />
                <h2>
                  Tip {0.01 * i} SEI to user{i}.eth
                </h2>
                <h3>{i} mins ago</h3>
              </a>
            ))}
          </div>
        </div>
        <Chat/>
        <WalletSec/>
      </main>
    </div>
  );
}

export default Dasboard;
