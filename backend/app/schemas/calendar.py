from pydantic import BaseModel


class CalendarSubscriptionOut(BaseModel):
    """The user's iCal feed URL. `token` is the same secret embedded in `url`,
    exposed separately so the client can show a 'regenerate' affordance."""

    url: str
    token: str
