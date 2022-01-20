import React from 'react';
import { Link, useMatch, useResolvedPath } from 'react-router-dom';

function NavLink({ children, to, ...props }) {
  let resolved = useResolvedPath(to);
  let match = useMatch({ path: resolved.pathname, end: true });

  return (
    <div>
      <Link
        to={to}
        className="m-0px mr-32px ff-big-noodle fw-normal fs-60px c-white td-none"
        style={{ opacity: match ? 1.0 : 0.5 }}
        {...props}
      >
        {children}
      </Link>
    </div>
  );
}

export default NavLink;