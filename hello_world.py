import os
import webapp2
import logging
import time

import jinja2

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)))
    
from base_handler import BaseHandler
#from django.utils import simplejson
import json
from datetime import date, datetime

from models import Token, History
from google.appengine.ext import ndb, db
from google.appengine.api import channel

import urbanairship
f=open('ua_prop')
key = f.next().strip()
secret = f.next().strip()
f.close()

airship = urbanairship.Airship(key, secret)

from google.appengine.api import users

class MyHandler(webapp2.RequestHandler):
    def get(self):
        user = users.get_current_user()
        if user:
            q = Token.query(Token.email == user.email().lower())
            token = q.get()
            if token and token.version:
                template = jinja_environment.get_template('templates/index_with_contact.html')
            else:
                template = jinja_environment.get_template('templates/index.html')
            status = 100
            if token:status = 200
            chat_token = self.request.cookies.get('token2', None)
            if not chat_token:
                chat_token = channel.create_channel(user.email().lower(), 1440)
                expires = time.time() + 86400
                self.response.headers.add_header(
                    'Set-Cookie', 
                    'token2=%s; expires=%s' \
                      % (chat_token, time.strftime("%a, %d-%b-%Y %T GMT", time.gmtime(expires))))

            self.response.out.write(template.render({'status':status, 
                'logout':users.create_logout_url("/"), 'token':chat_token}))
        else:
            template = jinja_environment.get_template('templates/landing.html')
            self.response.out.write(template.render({"path": users.create_login_url("/")}))
            
    def post(self):
        isajax = self.request.get('isajax')
        phone = self.request.get('phone')
        msg = self.request.get('msg')
        contact_name = self.request.get('contact_name')

        user = users.get_current_user()
        email = user.email().lower()
        q = Token.query(Token.email == email)
        token = q.get()
        status = 100
        hist=''
        logging.debug(email + ' ' + phone + ' ' + msg + ' ' + contact_name)
        if token:
            status = 101
            if len(phone) and len(msg):
                status = 200
                hist = History(email=email, msg=msg, phone=phone, contact_name = contact_name)
                hist.put()
                airship.push({
                    "android": {
                         "extra": {"msgid": str(hist.key.id()), "phone": phone, "msg":msg}
                    }
                }, apids=[token.apid])
                id = hist.key.id()
                hist = hist.to_dict()
                hist['created']=hist['created'].isoformat();
                hist['id'] = id
                hist['type'] = 'sms'        
        self.response.out.write(json.dumps({'status':status, 'msg':hist}))
        
class RegisterHandler(BaseHandler):
    def get(self):
        apid = self.request.get("apid")
        email = self.request.get("email",'').lower()
        version = int(self.request.get("version", "0"))
        q = Token.query(Token.email == email)
        token = q.get()
        if token:
            token.apid = apid
            token.email = email
            token.version = version
        else:
            q = Token.query(Token.apid == apid)
            token = q.get()
            if token:
                token.apid = apid
                token.email = email
                token.version=version
            else:token = Token(apid=apid, email=email, version=version)
        token.put()

        cb = self.request.get('callback')
        self.response.headers['Content-Type'] = 'application/json'
        if cb:
            self.response.out.write(cb+'(' + json.dumps({}) +');')
        else:
            self.response.out.write(json.dumps({}))

class DeliveryHandler(BaseHandler):
    def get(self):
        msgid = self.request.get("msgid")
        cb = self.request.get('callback')
        sent = self.request.get('sent')
        self.response.headers['Content-Type'] = 'application/json'
        item = ndb.Key('History', int(msgid)).get()
        if item:
            item.sent = True
            item.put()
            message = json.dumps({
                'type': 'delivery',
                'id': msgid
            })
            channel.send_message(item.email, message)
        
        if cb:
            self.response.out.write(cb+'(' + json.dumps({}) +');')
        else:
            self.response.out.write(json.dumps({}))

class HistoryHandler(BaseHandler):
    def get(self):
        PAGESIZE = 50
        contact_name = self.request.get('contact_name')    
        user = users.get_current_user()
        hist = History.query(History.email == user.email().lower())
        if contact_name:
            hist = hist.filter(History.contact_name == contact_name)
        hist = hist.order(-History.created).fetch(PAGESIZE)
        if self.request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            self.response.headers['Content-Type'] = 'application/json'
            hist = [[e.to_dict(), e.key.id()] for e in hist]
            for e,id in hist:
                e['created']=e['created'].isoformat();
                e['id'] = id
            self.response.out.write(json.dumps({'hist':[e[0] for e in hist]}))
        else:
            template = jinja_environment.get_template('templates/history.html')
            self.response.out.write(template.render({'hist':hist}))

class SMSReceiver(BaseHandler):
    def get(self):
        contact_name = self.request.get('contact_name')    
        phone = self.request.get('phone')
        msg = self.request.get('msg')
        email = self.request.get("email",'').lower()
        hist = History(email=email, msg=msg, phone=phone, contact_name = contact_name, byme=False)
        hist.put()
        id = hist.key.id()
        hist = hist.to_dict()
        hist['created']=hist['created'].isoformat();
        hist['id'] = id
        hist['type'] = 'sms'  
        channel.send_message(email, json.dumps(hist))
        self.response.out.write(json.dumps({}))
        
class ChannelReceiver(BaseHandler):
    def get(self):
        user = users.get_current_user()
        token = channel.create_channel(user.email().lower(), 1440)
        expires = time.time() + 86400
        self.response.headers.add_header(
            'Set-Cookie', 
            'token2=%s; expires=%s; path=/' \
              % (token, time.strftime("%a, %d-%b-%Y %T GMT", time.gmtime(expires))))
        self.response.out.write(json.dumps({'token':token}))

class ContactReceiver(BaseHandler):
    def post(self):
        logging.info("Hello")
        contacts = json.loads(self.request.get("contacts",'{}'))
        email = contacts['__email__online__sms'][0].lower()
        del contacts['__email__online__sms']
        q = Contacts.query(Contacts.email == email)
        c = q.get()
        if c:c.data = contacts
        else:c=Contacts(email=email, data=contacts)
        c.put()
        self.response.out.write(json.dumps({})) 

class ContactFetchReceiver(BaseHandler):
    def get(self):
        user = users.get_current_user()
        email = user.email().lower()
        res = Contacts.query(Contacts.email==email).get().data        
        self.response.out.write(json.dumps(res)) 
                             
class RobotsTextHandler(BaseHandler):
  def get(self):
    allow = os.environ['HTTP_HOST'] == 'fzonlinesms.appspot.com' # TODO: Change this after copying boilerplate
    self.template_out('html/robots.txt', {'allow': True})

app = webapp2.WSGIApplication([
  ('/', MyHandler),
  ('/push_register/', RegisterHandler),
  ('/delivery/', DeliveryHandler),
  ('/history/', HistoryHandler),
  ('/sms_received/', SMSReceiver),
  ('/new_chid/', ChannelReceiver),
  ('/save_contact/', ContactReceiver),
  ('/fetch_contacts/', ContactFetchReceiver),
], debug=os.environ['SERVER_SOFTWARE'].startswith('Dev'))
