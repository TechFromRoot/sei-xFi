import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../../assets/images/logo.png";
import { CiUser } from "react-icons/ci";
import { MdLockOutline, MdEmail } from "react-icons/md";
import { FaRegEyeSlash, FaRegEye } from "react-icons/fa6";
import { HiMiniBars3BottomRight } from "react-icons/hi2";
import { DynamicWidget, useDynamicContext } from "@dynamic-labs/sdk-react-core";

function Nav() {
  const userpopUpRef = useRef(null);
  const userpopUpRefChild = useRef(null);
  const mobileMenuRef = useRef(null);
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [signIn, setSignIn] = useState(true);
  const [classSec, setClassSec] = useState(true);
  const location = useLocation();
  const { pathname } = location;
  //
  // const { user } = useDynamicContext();

  // useEffect(() => {
  //   if (user) {
  //     console.log(user);
  //   }
  // }, [user]);
  //

  const toggleUserPopUp = (e) => {
    e.preventDefault();
    userpopUpRef.current.classList.toggle("active");
    setSignIn(true);
  };
  //
  const toggleMobileMenuPopUp = (e) => {
    e.preventDefault();
    mobileMenuRef.current.classList.toggle("active");
  };
  //
  const closeMobileMenuPopUp = (e) => {
    mobileMenuRef.current.classList.remove("active");
  };

  //

  useEffect(() => {
    
    if (pathname.includes("user") || pathname.includes("class")) {
      setClassSec(null);
    } else if (pathname.includes("instructor")) {
      setClassSec(null);
    } else {
      setClassSec(false);
    }
  }, [pathname]);

  return (
    <nav
      style={classSec === null ? { display: "none" } : { display: "flex" }}
      className={classSec ? "classSec" : ""}
    >
      <Link to="/" className="logo">
        <img src={logo} alt="" />
      </Link>
      <ul ref={mobileMenuRef}>
        <li>
          <Link to="/#about" onClick={closeMobileMenuPopUp}>
            About
          </Link>
        </li>
        <li>
          <Link to="/courses" onClick={closeMobileMenuPopUp}>
            How to
          </Link>
        </li>
        <li>
          <Link to="/courses" onClick={closeMobileMenuPopUp}>
            Join
          </Link>
        </li>

        <Link to="sign" className="btn" onClick={toggleUserPopUp}>
          <DynamicWidget />
        </Link>
      </ul>
      <HiMiniBars3BottomRight
        className="bars"
        onClick={toggleMobileMenuPopUp}
      />
    </nav>
  );
}

export default Nav;
