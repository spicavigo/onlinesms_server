import os
import webapp2
import logging

import jinja2
import os

jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__)))
    
from base_handler import BaseHandler
#from django.utils import simplejson
import json
from datetime import date, datetime
import urllib2
import urllib
from models import Token
from google.appengine.ext import ndb, db

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
            template = jinja_environment.get_template('templates/index.html')
            self.response.out.write(template.render({}))
        else:
            template = jinja_environment.get_template('templates/login.html')
            self.response.out.write(template.render({"path": users.create_login_url("/")}))
            
    def post(self):
        user = users.get_current_user()
        q = Token.query(Token.email == user.email())
        token = q.get()
        
        airship.push({
            "android": {
                 "extra": {"phone": self.request.get('phone'), "msg":self.request.get('msg')}
            }
        }, apids=[token.apid])
        template = jinja_environment.get_template('templates/index.html')
        self.response.out.write(template.render({}))
        
        
class RegisterHandler(BaseHandler):
    def get(self):
        apid = self.request.get("apid")
        email = self.request.get("email")
        q = Token.query(Token.email == email)
        token = q.get()
        if token:
            token.apid = apid
            token.email = email
        else:
            q = Token.query(Token.apid == apid)
            token = q.get()
            if token:
                token.apid = apid
                token.email = email
            else:token = Token(apid=apid, email=email)
        token.put()

        cb = self.request.get('callback')
        self.response.headers['Content-Type'] = 'application/json'
        if cb:
            self.response.out.write(cb+'(' + json.dumps({}) +');')
        else:
            self.response.out.write(json.dumps({}))


       
class RobotsTextHandler(BaseHandler):
  def get(self):
    allow = os.environ['HTTP_HOST'] == 'fzonlinesms.appspot.com' # TODO: Change this after copying boilerplate
    self.template_out('html/robots.txt', {'allow': allow})

app = webapp2.WSGIApplication([
  ('/', MyHandler),
  ('/push_register/', RegisterHandler),
], debug=os.environ['SERVER_SOFTWARE'].startswith('Dev'))
