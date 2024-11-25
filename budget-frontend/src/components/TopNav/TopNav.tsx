import {Link} from 'react-router-dom';
import './TopNav.css';

const TopNav = () => {
    return (
        <nav className="top-nav">
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
            </ul>
        </nav>
    )
        ;
};

export default TopNav;