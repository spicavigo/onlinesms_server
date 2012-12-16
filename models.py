from google.appengine.ext import ndb

#class Post(ndb.Model):
#  author = ndb.StringProperty()
#  time = ndb.DateTimeProperty(auto_now_add=True)
#  title = ndb.StringProperty()
#  description = ndb.TextProperty(default='')
#  categories = ndb.StringProperty(repeated=True)
#  last_modified = ndb.DateTimeProperty(auto_now=True)
#
#  @property
#  def agoTime(self):
#    return agoTime(self.time)

class Token(ndb.Model):
    email = ndb.StringProperty()
    apid = ndb.StringProperty()

class History(ndb.Model):
    email = ndb.StringProperty()
    msg = ndb.TextProperty()
    contact_name = ndb.StringProperty()
    phone = ndb.StringProperty()
    sent = ndb.BooleanProperty(default=False)
    created = ndb.DateTimeProperty(auto_now_add=True)
    byme = ndb.BooleanProperty(default=True)
