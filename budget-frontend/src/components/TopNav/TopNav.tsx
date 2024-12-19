import {Link} from 'react-router-dom';
import styles from "./TopNav.module.css";

const TopNav = () => {
    return (
        <nav className={`${styles.topNav}`}>
            <ul>
                <li>
                    <Link to="/">Budget</Link>
                </li>
                <li>
                    <Link to="/calendar">Calendar</Link>
                </li>
                <li>
                    <Link to="/accounts">Accounts</Link>
                </li>
                <li>
                    <Link to="/ledger">Ledger</Link>
                </li>
                <li>
                    <Link to="/upload">Upload</Link>
                </li>
            </ul>
        </nav>
    )
        ;
};

export default TopNav;